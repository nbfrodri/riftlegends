import { readFileSync, writeFileSync } from "node:fs";
import {
	type Competition,
	competitionSchema,
} from "@rift-legends/contracts/competition-format";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import type { LeagueStage } from "./league-format-definitions.ts";
import { lck, lcp } from "./league-formats-east.ts";
import { lpl } from "./league-formats-lpl.ts";
import { cblol, lcs, lec } from "./league-formats-west.ts";
import {
	type LeagueSeries,
	leagueSeries,
	selectSeries,
} from "./league-series.ts";

const output = new URL("../../packages/core/content/real/", import.meta.url);
const definitions = {
	LCK: lck,
	LPL: lpl,
	LEC: lec,
	LCP: lcp,
	LCS: lcs,
	CBLOL: cblol,
};
export type LeagueId = keyof typeof definitions;

export function leagueSource(id: LeagueId) {
	const definition = definitions[id];
	const file = `${id.toLowerCase()}.json`;
	const snapshot = realSnapshotSchema.parse(
		JSON.parse(readFileSync(new URL(file, output), "utf8")),
	);
	const all = leagueSeries(snapshot);
	const teams: { id: string; league: string; seed: number }[] = JSON.parse(
		readFileSync(new URL("teams.json", output), "utf8"),
	);
	const roster = teams
		.filter((team) => team.league === id)
		.sort((a, b) => a.seed - b.seed)
		.map(({ id }) => id);
	const evidence = new Map(
		definition.stages.map((stage) => [
			stage.id,
			selectSeries(all, stage.evidence),
		]),
	);
	return { definition, file, snapshot, all, roster, evidence };
}

function realWindow(stage: LeagueStage, rows: LeagueSeries[]) {
	if (!rows.length) throw new Error(`No snapshot series for ${stage.id}`);
	const first = Math.floor(Math.min(...rows.map(({ day }) => day)) / 7);
	const last = Math.floor(Math.max(...rows.map(({ day }) => day)) / 7);
	const winter = first < 10;
	const spring = first >= 12 && first < 25;
	const summer = first >= 28 && first < 41;
	const regular =
		stage.play.type === "roundRobin" || stage.play.type === "groups";
	const earlyWinter = stage.id === "cup-groups" || stage.id === "split-1-high";
	// The winter snapshot exceeds the season-wide capacity before the real
	// playoff starts. Open two pools early and give each leg room to finish
	// before the next international window.
	const startWeek = earlyWinter ? 0 : spring && first < 16 ? 12 : first;
	const endWeek = winter
		? 10
		: spring
			? 25
			: summer
				? Math.min(41, last + 3)
				: last + 1;
	return {
		startWeek,
		weeks: endWeek - startWeek,
		matchDays: 7,
		maxSeriesPerDay: regular ? 2 : 4,
	};
}

function build(id: LeagueId): Competition {
	const { definition, file, snapshot, roster, evidence } = leagueSource(id);
	return competitionSchema.parse({
		id,
		kind: "league",
		stages: definition.stages.map((stage) => ({
			id: stage.id,
			parallelGroup: stage.parallelGroup,
			window: realWindow(stage, evidence.get(stage.id) ?? []),
			entrants:
				stage.entrants === "roster"
					? {
							kind: "fixed",
							teams: stage.evidence.anchor
								? roster.filter((team) =>
										evidence
											.get(stage.id)
											?.some((row) => row.teams.includes(team)),
									)
								: roster,
						}
					: stage.entrants,
			play: stage.play,
		})),
		tiebreak: [
			"seriesWins",
			"gameDiff",
			"headToHead",
			"tiebreakerSeries",
			"draw",
		],
		tiebreakerBestOf: 3,
		slots: definition.qualifiers.map(([stage, count], i) => ({
			to: ["first-stand", "msi", "worlds"][i],
			stage,
			count,
			rule: "standing",
			cascade: "next",
		})),
		verified: false,
		provenance: {
			source: snapshot.provenance.source,
			licence: snapshot.provenance.licence,
			attribution: snapshot.provenance.attribution,
			retrievedAt: snapshot.provenance.retrievedAt,
			snapshot: file,
		},
		unverifiedReasons: [
			"Official tiebreak criteria are unconfirmed; use the game defaults, including Bo3 at a cut.",
			"Fixed bracket seeds and international places use stage finishes; official seeding, points and cascade rules are unconfirmed.",
			"The global four-series cap requires wider domestic windows than the snapshot; some starts move by more than seven days.",
			...definition.notes,
		],
	});
}

export function buildLeagueFormats(): Record<LeagueId, Competition> {
	return {
		LCK: build("LCK"),
		LPL: build("LPL"),
		LEC: build("LEC"),
		LCP: build("LCP"),
		LCS: build("LCS"),
		CBLOL: build("CBLOL"),
	};
}

export function writeLeagueFormats() {
	const formats = Object.values(buildLeagueFormats());
	for (const format of formats) {
		writeFileSync(
			new URL(`formats/${format.id.toLowerCase()}.json`, output),
			`${JSON.stringify(format, null, "\t")}\n`,
		);
		for (const reason of format.unverifiedReasons ?? [])
			console.log(`${format.id}: ${reason}`);
	}
}
