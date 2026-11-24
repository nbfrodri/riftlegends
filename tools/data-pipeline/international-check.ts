import type { Competition } from "@rift-legends/contracts/competition-format";
import type { InternationalMatch } from "@rift-legends/contracts/real-internationals";
import {
	buildDoubleElim,
	buildSingleElim,
} from "../../packages/core/competition/bracket.ts";
import { resolveBracket } from "../../packages/core/competition/bracket-state.ts";
import {
	internationalDefinitions,
	stageMatches,
} from "./international-formats.ts";

// Plan 12, R1: replays the real series of an event against its curated format
// and lists every difference (teams, series per stage, Bo per round, pairings).

type Event = {
	id: keyof typeof internationalDefinitions;
	matches: InternationalMatch[];
};
type Play = Competition["stages"][number]["play"];

const winnerOf = (m: InternationalMatch) =>
	m.score1 > m.score2 ? m.team1 : m.team2;

/** Seeds the bracket so that its first round is the real first round. */
function replayBracket(
	play: Extract<Play, { type: "singleElim" | "doubleElim" }>,
	matches: readonly InternationalMatch[],
): string[] {
	const bracket =
		play.type === "singleElim" ? buildSingleElim(play) : buildDoubleElim(play);
	const seen = new Set<string>();
	const opening: [string, string][] = [];
	for (const m of matches) {
		if (seen.has(m.team1) || seen.has(m.team2)) continue;
		opening.push([m.team1, m.team2]);
		seen.add(m.team1).add(m.team2);
	}
	const first = bracket.matches.filter(
		(m) => m.side === "upper" && m.round === 1,
	);
	if (first.length !== opening.length) {
		return [
			`first round has ${opening.length} series, the bracket has ${first.length}`,
		];
	}
	const teams: string[] = [];
	first.forEach((m, k) => {
		for (const [slot, team] of [
			[m.a, opening[k]?.[0]],
			[m.b, opening[k]?.[1]],
		] as const) {
			if (slot.kind === "seed" && team) teams[slot.rank - 1] = team;
		}
	});
	const results: Record<string, string> = {};
	for (const m of matches) {
		const state = resolveBracket(bracket, teams, results);
		const hit = state.matches.find(
			(x) =>
				x.status === "ready" &&
				[x.teamA, x.teamB].sort().join() === [m.team1, m.team2].sort().join(),
		);
		if (!hit) {
			return [
				`series ${m.team1} vs ${m.team2} (${m.tab}) is not a ready match of the bracket`,
			];
		}
		if (hit.bestOf !== m.bestOf) {
			return [
				`${hit.id}: best of ${m.bestOf} played, the bracket has best of ${hit.bestOf}`,
			];
		}
		results[hit.id] = winnerOf(m);
	}
	const rest = resolveBracket(bracket, teams, results)
		.matches.filter((x) => x.status !== "done" && x.status !== "skipped")
		.map((x) => x.id);
	return rest.length
		? [`bracket series left unplayed: ${rest.join(", ")}`]
		: [];
}

function replaySwiss(
	play: Extract<Play, { type: "swiss" }>,
	matches: readonly InternationalMatch[],
): string[] {
	const record = new Map<string, { w: number; l: number }>();
	const met = new Set<string>();
	const get = (team: string) => {
		const found = record.get(team) ?? { w: 0, l: 0 };
		record.set(team, found);
		return found;
	};
	const rounds = [...new Set(matches.map((m) => m.tab))];
	for (const tab of rounds) {
		const playing = new Set<string>();
		for (const m of matches.filter((x) => x.tab === tab)) {
			const [a, b] = [get(m.team1), get(m.team2)];
			const label = `${m.team1} vs ${m.team2} (${tab})`;
			if (playing.has(m.team1) || playing.has(m.team2))
				return [`${label}: a team plays twice in one round`];
			playing.add(m.team1).add(m.team2);
			if (a.w !== b.w || a.l !== b.l)
				return [`${label}: teams with different records`];
			if (a.w === play.wins || a.l === play.losses)
				return [`${label}: a team had already qualified or been eliminated`];
			const pair = [m.team1, m.team2].sort().join("|");
			if (met.has(pair)) return [`${label}: rematch`];
			met.add(pair);
			const decisive = a.w === play.wins - 1 || a.l === play.losses - 1;
			const expected = decisive ? play.decisiveBestOf : play.bestOf;
			if (m.bestOf !== expected)
				return [`${label}: best of ${m.bestOf}, expected best of ${expected}`];
			const winner = winnerOf(m) === m.team1 ? [a, b] : [b, a];
			(winner[0] as { w: number }).w += 1;
			(winner[1] as { l: number }).l += 1;
		}
	}
	const open = [...record].filter(
		([, r]) => r.w < play.wins && r.l < play.losses,
	);
	return open.length
		? [
				`teams still alive after the last round: ${open.map(([t]) => t).join(", ")}`,
			]
		: [];
}

export function checkInternational(
	event: Event,
	competition: Competition,
): string[] {
	const problems: string[] = [];
	const assigned = new Set<string>();
	for (const stage of competition.stages) {
		const def = internationalDefinitions[event.id].stages.find(
			(s) => s.id === stage.id,
		);
		if (!def) {
			problems.push(`${stage.id}: no definition of where its series are`);
			continue;
		}
		const matches = stageMatches(event, def);
		for (const m of matches) assigned.add(m.id);
		const teams = new Set(matches.flatMap((m) => [m.team1, m.team2]));
		if (teams.size !== stage.play.size) {
			problems.push(
				`${stage.id}: ${teams.size} teams in the series, size ${stage.play.size}`,
			);
			continue;
		}
		const { play } = stage;
		const found =
			play.type === "swiss"
				? replaySwiss(play, matches)
				: play.type === "singleElim" || play.type === "doubleElim"
					? replayBracket(play, matches)
					: [`${play.type} stages are not checked yet`];
		problems.push(...found.map((message) => `${stage.id}: ${message}`));
	}
	for (const m of event.matches) {
		if (!assigned.has(m.id)) problems.push(`no stage has series ${m.id}`);
	}
	return problems;
}
