import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { CargoRow } from "./client.ts";
import {
	field,
	groupBy,
	indexBy,
	key,
	orderBy,
	person,
	type ResolveChampion,
	type ResolveTeam,
	required,
	roleOf,
} from "./normalization.ts";
import type { SourceData } from "./queries.ts";

type Game = RealSnapshot["games"][number];
type GameLine = Game["lines"][number];
type GameTeam = Game["teams"][number];

function stat(row: CargoRow, name: string) {
	const value = field(row, name);
	if (value === undefined) return;
	if (!/^\d+$/.test(value))
		throw new Error(`Invalid ${name} in ${row.GameId}: ${value}`);
	return Number(value);
}

function lengthSeconds(row: CargoRow) {
	const value = field(row, "Gamelength");
	if (value === undefined) return;
	const match = /^(\d+):([0-5]\d)$/.exec(value);
	if (!match) throw new Error(`Invalid game length in ${row.GameId}: ${value}`);
	return Number(match[1]) * 60 + Number(match[2]);
}

function draftSlots(
	row: CargoRow,
	team: string,
	action: string,
	findChampion: ResolveChampion,
) {
	return Array.from({ length: 5 }, (_, index) =>
		championSlot(
			field(row, `${team}${action}${index + 1}`),
			action === "Ban",
			findChampion,
		),
	);
}

function scoreboardSlots(
	row: CargoRow,
	name: string,
	findChampion: ResolveChampion,
) {
	return (
		field(row, name)
			?.split(",")
			.map((value) =>
				championSlot(value.trim(), name.endsWith("Bans"), findChampion),
			) ?? []
	);
}

function championSlot(
	value: string | undefined,
	ban: boolean,
	findChampion: ResolveChampion,
) {
	return ban && value === "None" ? null : (findChampion(value) ?? null);
}

function gameDate(row: CargoRow) {
	const date = field(row, "DateTime_UTC") ?? required(row, "DateTime UTC");
	return `${date.replace(" ", "T")}Z`;
}

export function normalizeGames(
	source: Pick<SourceData, "games" | "lines" | "drafts">,
	resolveTeam: ResolveTeam,
	findChampion: ResolveChampion,
) {
	const people = new Map<string, string>();
	const games = indexBy(source.games, (row) => required(row, "GameId"), "game");
	const drafts = indexBy(
		source.drafts,
		(row) => required(row, "GameId"),
		"draft",
	);
	const lines = indexBy(
		source.lines,
		(row) => required(row, "GameRoleId"),
		"player line",
	);
	const byGame = groupBy(lines.values(), (row) => required(row, "GameId"));
	for (const id of byGame.keys()) {
		if (!games.has(id)) throw new Error(`Missing scoreboard game: ${id}`);
	}
	const oddities = {
		// A listed draft can exist before any scored game. Keep the scoreboard
		// as the game index and report draft-only rows from the source.
		orphanDrafts: [...drafts.keys()].filter((id) => !games.has(id)).length,
		missingDraft: 0,
		partialDraft: 0,
		incompleteLines: 0,
		missingWinner: 0,
		missingPatch: 0,
	};
	const output: Game[] = [];
	// Read the latest public handle for each player, using game id to break ties.
	for (const row of orderBy(source.games, (row) =>
		key(gameDate(row), required(row, "GameId")),
	)) {
		const id = required(row, "GameId");
		const draft = drafts.get(id);
		const gameLines: GameLine[] = [];
		const sides = new Map<string, GameTeam["side"]>();
		const records = orderBy(byGame.get(id) ?? [], (row) =>
			required(row, "GameRoleId"),
		);
		for (const record of records) {
			const player = person(required(record, "Link"), field(record, "Name"));
			people.set(player.id, player.name);
			const team = resolveTeam(required(record, "Team"));
			const side = field(record, "Side");
			if (side === "1" || side === "2") {
				const name = side === "1" ? "blue" : "red";
				if (sides.has(team) && sides.get(team) !== name)
					throw new Error(`Conflicting side for ${team} in ${id}`);
				sides.set(team, name);
			}
			gameLines.push({
				player: player.id,
				team,
				champion: findChampion(field(record, "Champion")),
				role:
					roleOf(field(record, "IngameRole")) ?? roleOf(field(record, "Role")),
				kills: stat(record, "Kills"),
				deaths: stat(record, "Deaths"),
				assists: stat(record, "Assists"),
				cs: stat(record, "CS"),
				gold: stat(record, "Gold"),
				damageToChampions: stat(record, "DamageToChampions"),
				visionScore: stat(record, "VisionScore"),
			});
		}
		const first = resolveTeam(required(row, "Team1"));
		const second = resolveTeam(required(row, "Team2"));
		const firstSide =
			sides.get(first) ?? (sides.get(second) === "blue" ? "red" : "blue");
		const secondSide =
			sides.get(second) ?? (firstSide === "blue" ? "red" : "blue");
		const draftFirst = draft && resolveTeam(required(draft, "Team1"));
		const draftSecond = draft && resolveTeam(required(draft, "Team2"));
		if (
			draft &&
			!(
				(draftFirst === first && draftSecond === second) ||
				(draftFirst === second && draftSecond === first)
			)
		) {
			throw new Error(`Draft teams differ from scoreboard in ${id}`);
		}
		function gameTeam(
			team: string,
			side: GameTeam["side"],
			slot: string,
		): GameTeam {
			const picks = scoreboardSlots(row, `${slot}Picks`, findChampion);
			const bans = scoreboardSlots(row, `${slot}Bans`, findChampion);
			if (!draft) return { id: team, side, picks, bans };
			const draftSlot = draftFirst === team ? "Team1" : "Team2";
			const orderedPicks = draftSlots(draft, draftSlot, "Pick", findChampion);
			const orderedBans = draftSlots(draft, draftSlot, "Ban", findChampion);
			return { id: team, side, picks: orderedPicks, bans: orderedBans };
		}
		const firstTeam = gameTeam(first, firstSide, "Team1");
		const secondTeam = gameTeam(second, secondSide, "Team2");
		const winTeam = field(row, "WinTeam");
		const winSlot = field(row, "Winner");
		const winner = winTeam
			? resolveTeam(winTeam)
			: winSlot === "1"
				? first
				: winSlot === "2"
					? second
					: undefined;
		const patch = field(row, "Patch");
		if (!winner) oddities.missingWinner++;
		if (!patch) oddities.missingPatch++;
		if (!draft) oddities.missingDraft++;
		else if (
			[firstTeam, secondTeam].some(
				(team) => team.picks.includes(null) || team.bans.includes(null),
			)
		)
			oddities.partialDraft++;
		if (gameLines.length !== 10) oddities.incompleteLines++;
		output.push({
			id,
			tournament: required(row, "OverviewPage"),
			date: gameDate(row),
			teams:
				firstSide === "blue"
					? [firstTeam, secondTeam]
					: [secondTeam, firstTeam],
			winner,
			lengthSeconds: lengthSeconds(row),
			patch,
			draftOrder: draft !== undefined,
			lines: gameLines,
		});
	}
	return { games: orderBy(output, (game) => game.id), people, oddities };
}
