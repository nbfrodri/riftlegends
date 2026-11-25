import {
	asymmetricSix,
	double,
	type LeagueDefinition,
	result,
	rounds,
	rr,
	single,
	stage,
	standing,
	swiss,
	twoSeries,
	weeks,
} from "./league-format-definitions.ts";

const lckCup = "Cup";
const lckPlayIn = "Season Play-In";
export const lck: LeagueDefinition = {
	tiebreakRule: {
		criteria: ["seriesWins", "gameDiff", "headToHead", "tiebreakerSeries"],
		bestOf: 3,
		reason:
			"Tiebreak order (wins, set difference, head-to-head) comes from the 2025 LCK rulebook, section 2.8 (the 2026 edition was not available). The rulebook's single-game tiebreaker is replaced by the game's Bo3 by user decision.",
	},
	stages: [
		stage("cup-groups", lckCup, weeks, "roster", {
			type: "groups",
			size: 10,
			count: 2,
			seeding: "cross",
			inner: { rounds: 1, bestOf: 3 },
		}),
		...twoSeries(
			"cup-playin-r1",
			lckCup,
			/^Play-In Round 1$/,
			[
				[standing("cup-groups", 6), standing("cup-groups", 9)],
				[standing("cup-groups", 7), standing("cup-groups", 8)],
			],
			3,
		),
		...twoSeries(
			"cup-playin-r2",
			lckCup,
			/^Play-In Round 2$/,
			[
				[standing("cup-groups", 4), result("cup-playin-r1-1")],
				[standing("cup-groups", 5), result("cup-playin-r1-2")],
			],
			3,
		),
		stage(
			"cup-playin-r3",
			lckCup,
			/^Play-In Round 3$/,
			[
				result("cup-playin-r2-1", "U1-1", "loser"),
				result("cup-playin-r2-2", "U1-1", "loser"),
			],
			single(5),
		),
		stage(
			"cup-playoffs",
			lckCup,
			/^Playoffs Round \d+$|^Finals$/,
			[
				standing("cup-groups", 1, 3),
				result("cup-playin-r2-1"),
				result("cup-playin-r2-2"),
				result("cup-playin-r3"),
			],
			asymmetricSix(),
		),
		stage("rounds-1-2", "Rounds 1-2", weeks, "roster", rr(10, 2)),
		stage(
			"road-to-msi",
			"Road to MSI",
			rounds,
			standing("rounds-1-2", 1, 6),
			double(6, [[3]], [5, 5, 5, 5], [2, 1, 1], [5], null),
		),
		stage("rounds-3-4", "Rounds 3-4", weeks, standing("rounds-1-2", 1, 10), {
			type: "groups",
			size: 10,
			count: 2,
			seeding: "ranked",
			inner: { rounds: 2, bestOf: 3 },
		}),
		...twoSeries(
			"season-playin-r1",
			lckPlayIn,
			/^Round 1$/,
			[
				[standing("rounds-3-4", 5), standing("rounds-3-4", 8)],
				[standing("rounds-3-4", 6), standing("rounds-3-4", 7)],
			],
			5,
		),
		stage(
			"season-playin-r2",
			lckPlayIn,
			/^Round 2$/,
			[
				result("season-playin-r1-1", "U1-1", "loser"),
				result("season-playin-r1-2"),
			],
			single(5),
		),
		stage(
			"season-playoffs",
			"Season Playoffs",
			rounds,
			[
				standing("rounds-3-4", 1, 4),
				result("season-playin-r1-1"),
				result("season-playin-r2"),
			],
			asymmetricSix(),
		),
	],
	qualifiers: [
		["cup-playoffs", 2],
		["road-to-msi", 2],
		["season-playoffs", 4],
	],
	notes: [
		"Cup cross-group play uses Bo3 throughout; lolesports confirms the Super Week series are Bo5 and worth 2 group points, not modelled.",
		"Cup advancement uses a combined table instead of winning/losing group privileges. Summer cuts use the ranked Legend/Rise stage table.",
		"The snapshot has only one game for Dplus Kia vs Gen.G in Week 10; the scheduled series is Bo3.",
	],
};

const lcpPlayoffs = () => double(6, [[null, null], [0, 0], [1]], [5, 5]);
const lcpFinals = "Split 3";
export const lcp: LeagueDefinition = {
	stages: [
		stage("split-1", "Split 1", weeks, "roster", rr(8)),
		stage(
			"split-1-playoffs",
			"Split 1 Playoffs",
			rounds,
			standing("split-1", 1, 6),
			lcpPlayoffs(),
		),
		stage("split-2", "Split 2", weeks, "roster", rr(8)),
		stage(
			"split-2-playoffs",
			"Split 2 Playoffs",
			rounds,
			standing("split-2", 1, 6),
			lcpPlayoffs(),
		),
		stage("split-3-swiss", lcpFinals, /^Round \d+$/, "roster", swiss(5)),
		stage(
			"split-3-seed-high",
			lcpFinals,
			/^Seeding$/,
			standing("split-3-swiss", 1, 2),
			single(5),
			{ match: 1, parallelGroup: "split-3-seeding" },
		),
		stage(
			"split-3-seed-low",
			lcpFinals,
			/^Seeding$/,
			standing("split-3-swiss", 5, 6),
			single(5),
			{ match: 2, parallelGroup: "split-3-seeding" },
		),
		stage(
			"split-3-seed-final",
			lcpFinals,
			/^Seeding$/,
			[result("split-3-seed-high"), standing("split-3-swiss", 3)],
			single(5),
			{ match: 3 },
		),
		stage(
			"split-3-playoffs",
			lcpFinals,
			/^Quarterfinals$|^Semifinals$|^Finals$/,
			[
				result("split-3-seed-final"),
				result("split-3-seed-final", "U1-1", "loser"),
				result("split-3-seed-high", "U1-1", "loser"),
				standing("split-3-swiss", 4),
			],
			double(4, [[0, 0], [1]], [5, 5]),
		),
	],
	qualifiers: [
		["split-1-playoffs", 1],
		["split-2-playoffs", 2],
		["split-3-playoffs", 3],
	],
	notes: [
		"Split 3 Swiss rules (Bo3, Bo5 on the third win or loss, Bo5 seeding matches) match lolesports. The calendar reserves up to three series in round 5; the snapshot has one. The third Worlds place goes to the Championship Points leader (ties: Split 3 playoff placement, then Swiss result), approximated here by the playoff third place.",
		"The split 3 seeding ladder approximates team selection from the Swiss; the bottom seeding match is for placement only.",
	],
};
