import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RealTimelines } from "@rift-legends/contracts/real-timelines";
import { type Client, type ClientOptions, wikiUrl } from "./client.ts";
import { inList } from "./queries.ts";
import { leagues } from "./scope.ts";

/**
 * Riot match timelines that Leaguepedia stores (`V5 data:<id>/Timeline`).
 * Each one is reduced to a `GameDigest` before it is cached, and only the
 * aggregates of many games are published: no game, team or player is kept.
 * LPL has no timelines.
 */

type Team = 100 | 200;
type Kind = "baron" | "dragon" | "herald" | "tower" | "inhibitor";

/** Everything the aggregates need from one game; seconds, no names. */
export interface GameDigest {
	/** Second of GAME_END. */
	end: number;
	winner: Team;
	/** `[second, participantId]`, sorted. Participants 1-5 are blue, 6-10 red. */
	deaths: [number, number][];
	/** Per participant, the second of each level-up from level 2. */
	levels: number[][];
	/** `[second, kind, team that took it]`, sorted. */
	objectives: [number, Kind, Team][];
}

const roles = ["top", "jungle", "mid", "bot", "support"] as const;
const teamOf = (pid: number): Team => (pid <= 5 ? 100 : 200);
const other = (team: Team): Team => (team === 100 ? 200 : 100);
const seconds = (milliseconds: unknown) => {
	if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds))
		throw new Error("Invalid timeline timestamp");
	return Math.floor(milliseconds / 1000);
};
const monsters: Record<string, Kind> = {
	BARON_NASHOR: "baron",
	DRAGON: "dragon",
	RIFTHERALD: "herald",
};
const buildings: Record<string, Kind> = {
	TOWER_BUILDING: "tower",
	INHIBITOR_BUILDING: "inhibitor",
};

interface RawEvent {
	type?: string;
	timestamp?: number;
	participantId?: number;
	victimId?: number;
	killerTeamId?: number;
	teamId?: number;
	winningTeam?: number;
	monsterType?: string;
	buildingType?: string;
}

/** Reduces a Riot v5 timeline; throws when it is not one. */
export function digestTimeline(raw: unknown): GameDigest {
	const frames = (raw as { frames?: unknown } | null)?.frames;
	if (!Array.isArray(frames)) throw new Error("Invalid timeline");
	const digest: GameDigest = {
		end: -1,
		winner: 100,
		deaths: [],
		levels: Array.from({ length: 10 }, () => []),
		objectives: [],
	};
	for (const frame of frames) {
		for (const event of (frame?.events ?? []) as RawEvent[]) {
			if (event.type === "CHAMPION_KILL") {
				const victim = Number(event.victimId);
				if (victim >= 1 && victim <= 10)
					digest.deaths.push([seconds(event.timestamp), victim]);
			} else if (event.type === "LEVEL_UP") {
				const pid = Number(event.participantId);
				if (pid >= 1 && pid <= 10)
					digest.levels[pid - 1]?.push(seconds(event.timestamp));
			} else if (event.type === "ELITE_MONSTER_KILL") {
				const kind = monsters[event.monsterType ?? ""];
				if (kind && (event.killerTeamId === 100 || event.killerTeamId === 200))
					digest.objectives.push([
						seconds(event.timestamp),
						kind,
						event.killerTeamId,
					]);
			} else if (event.type === "BUILDING_KILL") {
				const kind = buildings[event.buildingType ?? ""];
				if (kind && (event.teamId === 100 || event.teamId === 200))
					digest.objectives.push([
						seconds(event.timestamp),
						kind,
						other(event.teamId),
					]);
			} else if (event.type === "GAME_END") {
				if (event.winningTeam !== 100 && event.winningTeam !== 200)
					throw new Error("Invalid timeline winner");
				digest.end = seconds(event.timestamp);
				digest.winner = event.winningTeam;
			}
		}
	}
	if (digest.end < 0) throw new Error("Timeline without GAME_END");
	const byTime = (a: [number, ...unknown[]], b: [number, ...unknown[]]) =>
		a[0] - b[0];
	digest.deaths.sort(byTime);
	digest.objectives.sort(byTime);
	for (const list of digest.levels) list.sort((a, b) => a - b);
	return digest;
}

/** Base respawn window by level (tenths of a second), LoL Wiki "Death". */
const baseRespawn = [
	100, 100, 120, 120, 140, 160, 200, 250, 280, 325, 350, 375, 400, 425, 450,
	475, 500, 525,
];

/** Time increase factor in thousandths of a percentage point (cap 50 %). */
function timeIncrease(second: number) {
	const steps = (from: number) => Math.ceil((second - from) / 30);
	if (second < 900) return 0;
	if (second < 1800) return steps(900) * 425;
	if (second < 2700) return 12_750 + steps(1800) * 300;
	return Math.min(50_000, 21_750 + steps(2700) * 1_450);
}

/** Seconds a player stays dead at `level` when dying at game second `second`. */
export function deathSeconds(level: number, second: number) {
	const base = baseRespawn[Math.min(18, Math.max(1, level)) - 1] as number;
	const scaled = base * (100_000 + timeIncrease(second));
	const quotient = Math.floor(scaled / 100_000);
	const rest = scaled % 100_000;
	const tenths =
		rest > 50_000 || (rest === 50_000 && quotient % 2)
			? quotient + 1
			: quotient;
	return Math.ceil(tenths / 10);
}

const levelAt = (digest: GameDigest, pid: number, second: number) =>
	1 + (digest.levels[pid - 1] ?? []).filter((at) => at <= second).length;

/** `[death, respawn)` of every death. */
function absences(digest: GameDigest) {
	return digest.deaths.map(([second, pid]) => ({
		pid,
		from: second,
		to: second + deathSeconds(levelAt(digest, pid, second), second),
	}));
}

const bp = (part: number, whole: number) =>
	whole ? Math.round((part * 10_000) / whole) : 0;

function percentile(sorted: number[], percent: number) {
	if (!sorted.length) return 0;
	return sorted[
		Math.max(0, Math.ceil((percent * sorted.length) / 100) - 1)
	] as number;
}

const fightGap = 15;
const conversionWindow = 60;
const lateFrom = 25 * 60;
const minCurveGames = 30;
const maxCurveMinutes = 60;

/** Deaths separated by at most `fightGap` seconds form one fight. */
function fights(digest: GameDigest) {
	const result: { first: number; last: number; lost: Record<Team, number> }[] =
		[];
	for (const [second, pid] of digest.deaths) {
		const current = result.at(-1);
		if (current && second - current.last <= fightGap) {
			current.last = second;
			current.lost[teamOf(pid)]++;
		} else {
			const lost = { 100: 0, 200: 0 };
			lost[teamOf(pid)]++;
			result.push({ first: second, last: second, lost });
		}
	}
	return result;
}

type Bands = RealTimelines["bands"];

export function aggregate(games: readonly GameDigest[]): {
	bands: Bands;
	levelCurve: RealTimelines["levelCurve"];
} {
	const k19 = {
		baron: { taken: 0, more: 0, fewer: 0 },
		inhibitor: { taken: 0, more: 0, fewer: 0 },
		tower: { taken: 0, more: 0, fewer: 0 },
	};
	const margins = [
		{ fights: 0, converted: 0 },
		{ fights: 0, converted: 0 },
		{ fights: 0, converted: 0 },
	];
	const late = { fights: 0, closed: 0 };
	const nexus = { games: 0, threeOrMore: 0 };
	const durations: number[] = [];

	for (const game of games) {
		const away = absences(game);
		const alive = (team: Team, second: number) =>
			5 -
			away.filter(
				({ pid, from, to }) =>
					teamOf(pid) === team && from <= second && second < to,
			).length;
		for (const [second, kind, team] of game.objectives) {
			if (kind !== "baron" && kind !== "inhibitor" && kind !== "tower")
				continue;
			const entry = k19[kind];
			const mine = alive(team, second);
			const theirs = alive(other(team), second);
			entry.taken++;
			if (mine > theirs) entry.more++;
			else if (mine < theirs) entry.fewer++;
		}
		for (const fight of fights(game)) {
			const margin = Math.abs(fight.lost[100] - fight.lost[200]);
			if (!margin) continue;
			const winner: Team = fight.lost[100] < fight.lost[200] ? 100 : 200;
			const bucket = margins[
				Math.min(margin, 3) - 1
			] as (typeof margins)[number];
			bucket.fights++;
			if (
				game.objectives.some(
					([second, , team]) =>
						team === winner &&
						second > fight.last &&
						second <= fight.last + conversionWindow,
				)
			)
				bucket.converted++;
			if (fight.first >= lateFrom && fight.lost[other(winner)] >= 4) {
				late.fights++;
				if (game.winner === winner && game.end - fight.last <= conversionWindow)
					late.closed++;
			}
		}
		nexus.games++;
		if (5 - alive(other(game.winner), game.end) >= 3) nexus.threeOrMore++;
		for (const { to, from } of away) durations.push(to - from);
	}

	durations.sort((a, b) => a - b);
	const band = (entry: { taken: number; more: number; fewer: number }) => ({
		...entry,
		moreBp: bp(entry.more, entry.taken),
		fewerBp: bp(entry.fewer, entry.taken),
	});
	const marginLabels = ["1", "2", "3+"] as const;
	const [m1, m2, m3] = margins.map((entry, index) => ({
		margin: marginLabels[index] as (typeof marginLabels)[number],
		...entry,
		bp: bp(entry.converted, entry.fights),
	}));
	return {
		bands: {
			k19: {
				baron: band(k19.baron),
				inhibitor: band(k19.inhibitor),
				tower: band(k19.tower),
			},
			k20: [m1, m2, m3] as Bands["k20"],
			k21: {
				lateFights: { ...late, bp: bp(late.closed, late.fights) },
				nexus: { ...nexus, bp: bp(nexus.threeOrMore, nexus.games) },
			},
			k22: {
				deaths: durations.length,
				p10: percentile(durations, 10),
				p50: percentile(durations, 50),
				p90: percentile(durations, 90),
			},
		},
		levelCurve: levelCurve(games),
	};
}

/** Median level per role and minute (tenths), while at least 30 games last. */
function levelCurve(games: readonly GameDigest[]) {
	const curve: Record<(typeof roles)[number], number[]> = {
		top: [],
		jungle: [],
		mid: [],
		bot: [],
		support: [],
	};
	for (let minute = 1; minute <= maxCurveMinutes; minute++) {
		const alive = games.filter((game) => game.end >= minute * 60);
		if (alive.length < minCurveGames) break;
		roles.forEach((role, index) => {
			const levels = alive
				.flatMap((game) =>
					[index + 1, index + 6].map((pid) => levelAt(game, pid, minute * 60)),
				)
				.sort((a, b) => a - b);
			const middle = levels.length >> 1;
			curve[role].push(
				levels.length % 2
					? (levels[middle] as number) * 10
					: ((levels[middle - 1] as number) + (levels[middle] as number)) * 5,
			);
		});
	}
	return curve;
}

/** The leagues with timelines: the six of the snapshot except LPL. */
const withTimelines = leagues.filter(({ id }) => id !== "LPL");

interface Page {
	digest: GameDigest | null;
}

function readPage(body: unknown): Page {
	const cached = (body as { digest?: GameDigest | null } | null)?.digest;
	if (cached !== undefined) return { digest: cached };
	const pages = (body as { query?: { pages?: Record<string, unknown> } })?.query
		?.pages;
	const page = Object.values(pages ?? {})[0] as
		| {
				revisions?: {
					slots?: { main?: Record<string, string> };
					"*"?: string;
				}[];
		  }
		| undefined;
	const revision = page?.revisions?.[0];
	const text =
		revision?.slots?.main?.["*"] ??
		revision?.slots?.main?.content ??
		revision?.["*"];
	if (typeof text !== "string") return { digest: null };
	return { digest: digestTimeline(JSON.parse(text)) };
}

/**
 * Digests of the finished games of `season` before `through` (a UTC day, so
 * the list query changes daily and a game page never does). Pages that are
 * missing are skipped.
 */
export async function acquireTimelines(
	client: Client,
	season: number,
	through: string,
) {
	const rows = await client.cargo(
		"ScoreboardGames=SG,Tournaments=T,PostgameJsonMetadata=PJM",
		"T.League=League,PJM.TimelinePage=Page",
		`T.Year='${season}' AND T.IsOfficial='1' AND T.TournamentLevel='Primary' AND ${inList(
			"T.League",
			withTimelines.map(({ name }) => name),
		)} AND PJM.TimelinePage IS NOT NULL AND SG.DateTime_UTC < '${through}'`,
		"PJM.TimelinePage",
		{ join_on: "SG.OverviewPage=T.OverviewPage,SG.GameId=PJM.GameId" },
	);
	const counts: Record<string, number> = {};
	const games: GameDigest[] = [];
	for (const row of rows) {
		const league = withTimelines.find(({ name }) => name === row.League);
		if (!league || !row.Page) continue;
		const { digest } = await client.get(
			wikiUrl({
				action: "query",
				prop: "revisions",
				rvprop: "content",
				rvslots: "main",
				titles: row.Page,
			}),
			readPage,
			(page) => page,
		);
		if (!digest) continue;
		games.push(digest);
		counts[league.id] = (counts[league.id] ?? 0) + 1;
	}
	return { games, counts: Object.fromEntries(Object.entries(counts).sort()) };
}

export function serializeTimelines(file: RealTimelines) {
	return `${JSON.stringify(file, null, "\t").replace(
		/\[\s+([\d,\s]+?)\s+\]/g,
		(_, list: string) => `[${list.replace(/\s+/g, " ")}]`,
	)}\n`;
}

interface TimelineOptions extends ClientOptions {
	/** Folder of the league snapshots; timelines.json is written next to them. */
	outputDir: string;
}

export async function writeTimelines(
	options: TimelineOptions,
	season: number,
	through: string,
	client: Client,
) {
	const { games, counts } = await acquireTimelines(client, season, through);
	const file: RealTimelines = {
		provenance: {
			source: "Leaguepedia",
			domain: "lol.fandom.com",
			licence: "CC BY-SA 3.0",
			attribution:
				"Agregados de las timelines de Riot que guarda Leaguepedia (https://lol.fandom.com/wiki/Leaguepedia), CC BY-SA 3.0 Unported. No se guardan datos por partida.",
			season,
		},
		games: counts,
		...aggregate(games),
	};
	const path = join(options.outputDir, "timelines.json");
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, serializeTimelines(file));
	return { games: games.length, counts };
}
