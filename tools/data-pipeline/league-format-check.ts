import type { Competition } from "@rift-legends/contracts/competition-format";
import { stageFixtures } from "../../packages/core/competition/calendar-fixtures.ts";
import { buildStageGraph } from "../../packages/core/competition/stage-graph.ts";
import { stageKey } from "../../packages/core/competition/stage-model.ts";
import { type LeagueId, leagueSource } from "./league-formats.ts";
import type { LeagueSeries } from "./league-series.ts";

export function leagueStageStarts(id: LeagueId) {
	return new Map(
		[...leagueSource(id).evidence].map(([stage, series]) => [
			stage,
			Math.min(...series.map(({ day }) => day)),
		]),
	);
}

const bos = (values: number[]) => values.sort((a, b) => a - b).join(",");

function swissRound(id: string) {
	return Number(id.split("-")[1]);
}

function snapshotRound(tab: string) {
	return Number(tab.match(/\d+$/)?.[0]);
}

/** Where Leaguepedia places upper and lower matches under a shared round label. */
function bracketTab(
	league: LeagueId,
	stage: string,
	side: string,
	round: number,
) {
	if (side === "final") return "Finals";
	if (stage === "road-to-msi")
		return side === "upper" ? "Round 3" : `Round ${round}`;
	if (stage.startsWith("split-1-ladder"))
		return `Play-In Round ${side === "upper" ? 1 : round + 1}`;
	if (stage === "split-3-playoffs") {
		if (round === 1) return "Quarterfinals";
		return "Semifinals";
	}
	if (
		league === "LEC" &&
		["spring-playoffs", "summer-playoffs"].includes(stage) &&
		side === "upper" &&
		round === 2
	)
		return "Round 3";
	if (league === "LCP") return `Round ${side === "lower" ? round + 1 : round}`;
	const roundNumber = side === "upper" && round === 3 ? 4 : round;
	return `Round ${roundNumber}`;
}

/** Compare all historical rows to the stage model, including explicit exceptions. */
export function checkLeagueFormat(id: LeagueId, format: Competition): string[] {
	const { all, definition, roster, evidence } = leagueSource(id);
	const graph = buildStageGraph(
		[{ ...format, slots: [] }],
		roster.map((team, index) => ({
			id: team,
			competition: id,
			region: id,
			rank: index + 1,
		})),
	);
	if (!graph.ok) return [JSON.stringify(graph.error)];
	const issues: string[] = [];
	const covered = new Set<string>();
	for (const stage of definition.stages) {
		const ref = { competition: id, stage: stage.id };
		const node = graph.graph.nodes.get(stageKey(ref));
		if (!node) {
			issues.push(`${stage.id}: missing stage`);
			continue;
		}
		const rows = evidence.get(stage.id) ?? [];
		for (const row of rows) {
			if (covered.has(row.id)) issues.push(`${row.id}: assigned twice`);
			covered.add(row.id);
		}
		const sample =
			id === "LEC" && stage.id === "versus"
				? rows.filter(({ teams }) =>
						teams.every((team) => roster.includes(team)),
					)
				: rows;
		if (
			sample !== rows &&
			(rows.length !== 66 ||
				new Set(rows.flatMap(({ teams }) => [...teams])).size !== 12)
		) {
			issues.push(
				"versus: expected 66 historical series from 12 teams before removing guests",
			);
		}
		const teams = new Set(sample.flatMap((row) => [...row.teams]));
		if (teams.size !== node.stage.play.size)
			issues.push(`${stage.id}: snapshot has ${teams.size} teams`);
		const source = node.stage.entrants;
		if (
			!Array.isArray(source) &&
			source.kind === "fixed" &&
			source.teams.some((team) => !teams.has(team))
		) {
			issues.push(`${stage.id}: roster differs from the snapshot`);
		}
		const generated = stageFixtures(graph.graph, node, new Map(), 42, 2026);
		if (generated.error) {
			issues.push(JSON.stringify(generated.error));
			continue;
		}
		const swissExtra = id === "LCP" && stage.id === "split-3-swiss" ? 2 : 0;
		if (sample.length !== generated.fixtures.length - swissExtra) {
			issues.push(
				`${stage.id}: snapshot has ${sample.length} series, format has ${generated.fixtures.length}`,
			);
		}
		const play = node.stage.play;
		if (play.type === "swiss") {
			for (const round of new Set(
				generated.fixtures.map((match) => swissRound(match.id)),
			)) {
				const fixtures = generated.fixtures.filter(
					(match) => swissRound(match.id) === round,
				);
				const actual = sample.filter(
					(match) => snapshotRound(match.tab) === round,
				);
				if (
					actual.length !==
					fixtures.length - (round === 5 ? swissExtra : 0)
				) {
					issues.push(`${stage.id}: Round ${round} series count differs`);
				}
				const regular =
					id !== "LCP" || round < 3 ? actual.length : round === 3 ? 2 : 0;
				const expected = [
					...Array<number>(regular).fill(play.bestOf),
					...Array<number>(Math.max(0, actual.length - regular)).fill(
						play.decisiveBestOf,
					),
				];
				if (bos(actual.map((match) => match.bestOf)) !== bos(expected)) {
					issues.push(`${stage.id}: Round ${round} best of differs`);
				}
			}
		} else if (node.bracket) {
			const expected = new Map<string, number[]>();
			for (const match of node.bracket.matches) {
				const tab =
					play.size === 2
						? (sample[0]?.tab ?? "")
						: bracketTab(id, stage.id, match.side, match.round);
				const values = expected.get(tab) ?? [];
				values.push(match.bestOf);
				expected.set(tab, values);
			}
			for (const tab of new Set([
				...expected.keys(),
				...sample.map((row) => row.tab.replace(/^Playoffs /, "")),
			])) {
				const actual = sample.filter(
					(row) => row.tab.replace(/^Playoffs /, "") === tab,
				);
				if (
					bos(actual.map((row) => row.bestOf)) !== bos(expected.get(tab) ?? [])
				) {
					issues.push(`${stage.id}: ${tab} best of or series count differs`);
				}
			}
		} else if (
			id === "LCK" &&
			stage.id === "cup-groups" &&
			play.type === "groups"
		) {
			for (const special of [false, true]) {
				const actual = sample.filter(
					({ tab }) => (tab === "Week 3") === special,
				);
				const planned = generated.fixtures.filter(
					({ earliestWeek }) => (earliestWeek === 2) === special,
				);
				if (
					bos(actual.map(({ bestOf }) => bestOf)) !==
					bos(planned.map(({ bestOf }) => bestOf ?? play.inner.bestOf))
				) {
					issues.push(
						`cup-groups: ${special ? "Week 3" : "Weeks 1–2"} best of or series count differs`,
					);
				}
			}
		} else {
			const bestOf =
				play.type === "groups"
					? play.inner.bestOf
					: play.type === "roundRobin"
						? play.bestOf
						: undefined;
			for (const row of sample) {
				if (normalizedBestOf(id, row) !== bestOf)
					issues.push(`${row.id}: best of differs`);
			}
		}
	}
	const splitOneTiebreak = "LPL/2026 Season/Split 1_Tiebreakers_1";
	if (
		id === "LPL" &&
		!all.some(
			({ id, bestOf }) =>
				id === splitOneTiebreak && bestOf === format.tiebreakerBestOf,
		)
	) {
		issues.push("split-1: expected the observed Bo3 tiebreaker");
	}
	for (const row of all) {
		if (covered.has(row.id)) continue;
		if (id === "LPL" && row.id === splitOneTiebreak) continue;
		issues.push(`${row.id}: no stage`);
	}
	return issues;
}

function normalizedBestOf(id: LeagueId, row: LeagueSeries) {
	if (
		id === "LCK" &&
		row.id === "LCK/2026 Season/Rounds 3-4_Week 10_8" &&
		row.bestOf === 1
	)
		return 3;
	return row.bestOf;
}
