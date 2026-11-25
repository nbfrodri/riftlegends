import {
	type Competition,
	competitionSchema,
} from "@rift-legends/contracts/competition-format";
import type {
	InternationalMatch,
	RealInternationals,
} from "@rift-legends/contracts/real-internationals";

// First Stand, MSI and Worlds as data (plan 12, deliverable 9). The structure
// is curated from what Leaguepedia shows; `international-check.ts` replays
// every real series against it. The windows come from the real dates.

type Event = RealInternationals["events"][number];
export type EventId = Event["id"];
type Stage = Competition["stages"][number];

/** Where the series of one stage are in the data. */
interface StageDef {
	id: string;
	/** Tournament page suffix; omitted when the event has a single page. */
	tournament?: string;
	tabs: readonly string[];
	/** Stage played side by side with others in the same tabs: nth group of teams. */
	group?: number;
	entrants: Stage["entrants"];
	play: Stage["play"];
	draw?: Stage["draw"];
}

interface Definition {
	stages: readonly StageDef[];
	tiebreak: Competition["tiebreak"];
	unverified: readonly string[];
}

const bo5 = (n: number) => Array<5>(n).fill(5);
type LeaguePlace = readonly [league: string, place: number];
const pool = (competition: EventId, ...places: LeaguePlace[]) => ({
	kind: "qualified" as const,
	competition,
	places: places.map(([league, place]) => ({ league, place })),
});

const winner = (stage: string, match: string) =>
	({ kind: "bracket", stage, match, result: "winner" }) as const;

const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];

function playInRoutes(
	event: EventId,
	slots: readonly number[],
	playIn: LeaguePlace[],
): { opening: Stage["entrants"]; main: Stage["entrants"] } {
	const direct: LeaguePlace[] = [];
	for (let place = 1; place <= Math.max(...slots); place++) {
		for (const [index, league] of leagues.entries()) {
			if ((slots[index] ?? 0) < place) continue;
			if (!playIn.some(([l, p]) => l === league && p === place))
				direct.push([league, place]);
		}
	}
	return {
		opening: pool(event, ...playIn),
		main: [pool(event, ...direct), winner("playin", "GF")],
	};
}

// Places inferred from the participating leagues and openings in the snapshot.
const msiRoutes = playInRoutes(
	"msi",
	[2, 2, 2, 2, 2, 1],
	[
		["LCK", 2],
		["LEC", 2],
		["LCP", 2],
		["LCS", 2],
	],
);
const worldsRoutes = playInRoutes(
	"worlds",
	[4, 4, 3, 3, 3, 2],
	[
		["LEC", 3],
		["LCP", 3],
		["CBLOL", 2],
		["LCS", 3],
	],
);

/** Four teams, double elimination, all Bo5; GSL groups have no grand final. */
const fourTeams = (grandFinal: 5 | null): Stage["play"] => ({
	type: "doubleElim",
	size: 4,
	upper: bo5(2),
	lower: bo5(2),
	drop: [[0, 0], [1]],
	lowerSeeds: [],
	grandFinal,
	reset: false,
});

const unverified = {
	"first-stand": [
		"Two GSL groups and Bo5 everywhere match lolesports coverage; the group seeding, the 2-slot LCK and LPL routes and the tiebreakers are not in a published 2026 rulebook we could read.",
	],
	msi: [
		"lolesports confirms 11 play-in teams (2 each from LCK, LCS, LCP, LEC and LPL, 1 from CBLOL), a Bo5 four-team double-elimination play-in and an eight-team bracket. Which second seeds bypass depends on First Stand results (LPL 2 is assumed), and the seeding is unpublished.",
	],
	worlds: [
		"lolesports confirms 19 teams (3 each from LCK, LCS, LCP, LEC and LPL, 2 from CBLOL, the MSI champion and one from the MSI runner-up region) and a Bo5 four-team play-in. The Swiss and knockout best-of formats, the seeding by MSI results and the tiebreakers are not published.",
	],
};

export const internationalDefinitions: Record<EventId, Definition> = {
	"first-stand": {
		tiebreak: [],
		unverified: unverified["first-stand"],
		stages: [
			{
				id: "groupA",
				tabs: [1, 2, 3, 4, 5].map((day) => `Groups Day ${day}`),
				group: 0,
				entrants: pool(
					"first-stand",
					["LPL", 1],
					["LEC", 1],
					["LCP", 1],
					["LCK", 2],
				),
				play: fourTeams(null),
			},
			{
				id: "groupB",
				tabs: [1, 2, 3, 4, 5].map((day) => `Groups Day ${day}`),
				group: 1,
				entrants: pool(
					"first-stand",
					["LCK", 1],
					["LCS", 1],
					["CBLOL", 1],
					["LPL", 2],
				),
				play: fourTeams(null),
			},
			{
				id: "knockout",
				tabs: ["Semifinals", "Finals"],
				entrants: [
					winner("groupA", "U2-1"),
					winner("groupB", "U2-1"),
					winner("groupA", "L2-1"),
					winner("groupB", "L2-1"),
				],
				play: { type: "singleElim", size: 4, bestOf: bo5(2) },
			},
		],
	},
	msi: {
		tiebreak: [],
		unverified: unverified.msi,
		stages: [
			{
				id: "playin",
				tabs: [1, 2, 3, 4].map((day) => `Play-In Day ${day}`),
				entrants: msiRoutes.opening,
				play: fourTeams(5),
			},
			{
				id: "bracket",
				tabs: [
					"Bracket Round 1",
					"Bracket Round 2",
					"Bracket Round 3",
					"Bracket Round 4",
					"Finals",
				],
				entrants: msiRoutes.main,
				play: {
					type: "doubleElim",
					size: 8,
					upper: bo5(3),
					lower: bo5(4),
					drop: [[0, 0, 0, 0], [1, 1], [3]],
					lowerSeeds: [],
					grandFinal: 5,
					reset: false,
				},
			},
		],
	},
	worlds: {
		tiebreak: [
			"seriesWins",
			"gameDiff",
			"headToHead",
			"tiebreakerSeries",
			"draw",
		],
		unverified: unverified.worlds,
		stages: [
			{
				id: "playin",
				tournament: "Play-In",
				tabs: ["Round 1", "Round 2", "Round 3"],
				entrants: worldsRoutes.opening,
				play: fourTeams(5),
			},
			{
				id: "swiss",
				tournament: "Main Event",
				tabs: ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"],
				entrants: worldsRoutes.main,
				draw: { pots: 4 },
				play: {
					type: "swiss",
					size: 16,
					wins: 3,
					losses: 3,
					bestOf: 1,
					decisiveBestOf: 3,
					round1: "pots",
					avoid: ["region", "rematch"],
				},
			},
			{
				id: "knockout",
				tournament: "Main Event",
				tabs: ["Quarterfinals", "Semifinals", "Finals"],
				entrants: { kind: "standing", stage: "swiss", from: 1, to: 8 },
				play: { type: "singleElim", size: 8, bestOf: bo5(3) },
			},
		],
	},
};

/** Series of one stage, in play order. */
export function stageMatches(
	event: Pick<Event, "matches">,
	def: StageDef,
): InternationalMatch[] {
	const inTabs = event.matches.filter(
		(m) =>
			def.tabs.includes(m.tab) &&
			(!def.tournament || m.tournament.endsWith(`/${def.tournament}`)),
	);
	if (def.group === undefined) return inTabs;
	// Groups share the tabs: teams that meet, directly or not, are one group.
	const root = new Map<string, string>();
	const find = (team: string): string => {
		const parent = root.get(team) ?? team;
		return parent === team ? team : find(parent);
	};
	for (const m of inTabs) root.set(find(m.team1), find(m.team2));
	const order = [...new Set(inTabs.map((m) => find(m.team1)))];
	return inTabs.filter((m) => find(m.team1) === order[def.group as number]);
}

const weekOf = (date: string, year: number) =>
	Math.floor((Date.parse(date) - Date.UTC(year, 0, 1)) / 86_400_000 / 7);

/** Weeks from 1 January, and the most distinct match days in one week. */
function windowOf(stage: string, matches: readonly InternationalMatch[]) {
	if (!matches.length) throw new Error(`No series for the stage ${stage}`);
	const year = Number((matches[0] as InternationalMatch).date.slice(0, 4));
	const days = new Map<number, Set<string>>();
	for (const { date } of matches) {
		const week = weekOf(date, year);
		days.set(week, (days.get(week) ?? new Set()).add(date));
	}
	const weeks = [...days.keys()];
	const startWeek = Math.min(...weeks);
	return {
		startWeek,
		weeks: Math.max(...weeks) - startWeek + 1,
		matchDays: Math.max(...[...days.values()].map((d) => d.size)),
	};
}

export function buildInternationalFormats(
	data: RealInternationals,
): Record<EventId, Competition> {
	const built = {} as Record<EventId, Competition>;
	for (const event of data.events) {
		const def = internationalDefinitions[event.id];
		built[event.id] = competitionSchema.parse({
			id: event.id,
			kind: "international",
			stages: def.stages.map((stage) => ({
				id: stage.id,
				window: windowOf(stage.id, stageMatches(event, stage)),
				entrants: stage.entrants,
				play: stage.play,
				draw: stage.draw,
			})),
			tiebreak: def.tiebreak,
			verified: def.unverified.length === 0,
		});
	}
	return built;
}

/** File name and contents of each generated format. */
export function internationalFormatFiles(
	formats: Record<EventId, Competition>,
): Record<string, Competition> {
	return Object.fromEntries(
		Object.values(formats).map((competition) => [
			`${competition.id}.json`,
			competition,
		]),
	);
}

/** Formats still waiting for a check against the rulebook, with the reasons. */
export function unverifiedFormats(formats: Record<EventId, Competition>) {
	return Object.values(formats)
		.filter(({ verified }) => !verified)
		.map(({ id }) => ({
			id,
			reasons: internationalDefinitions[id as EventId].unverified,
		}));
}
