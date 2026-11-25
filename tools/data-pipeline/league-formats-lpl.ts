import {
	double,
	eight,
	type LeagueDefinition,
	result,
	rounds,
	rr,
	single,
	stage,
	standing,
	twoSeries,
	weeks,
} from "./league-format-definitions.ts";

const lplSplit1 = "Split 1 Playoffs";
const lplSplit2 = "Split 2 Playoffs";
const lplGrand = "Grand Finals";
const ladder = double(4, [[1]], [5, 5], [2], [5], null);
export const lpl: LeagueDefinition = {
	stages: [
		stage("split-1-high", "Split 1", weeks, "roster", rr(6, 2), {
			parallelGroup: "split-1",
			anchor: "Bilibili Gaming",
		}),
		stage("split-1-mid", "Split 1", weeks, "roster", rr(4, 2), {
			parallelGroup: "split-1",
			anchor: "Team WE",
		}),
		stage("split-1-low", "Split 1", weeks, "roster", rr(4, 2), {
			parallelGroup: "split-1",
			anchor: "LNG Esports",
		}),
		stage(
			"split-1-ladder-a",
			lplSplit1,
			/^Play-In Round \d+$/,
			[
				standing("split-1-high", 5),
				standing("split-1-mid", 2),
				standing("split-1-mid", 3),
				standing("split-1-low", 2),
			],
			ladder,
			{ parallelGroup: "split-1-playin", anchor: "Top Esports" },
		),
		stage(
			"split-1-ladder-b",
			lplSplit1,
			/^Play-In Round \d+$/,
			[
				standing("split-1-high", 6),
				standing("split-1-mid", 1),
				standing("split-1-mid", 4),
				standing("split-1-low", 1),
			],
			ladder,
			{ parallelGroup: "split-1-playin", anchor: "Invictus Gaming" },
		),
		stage(
			"split-1-playoffs",
			lplSplit1,
			rounds,
			[
				standing("split-1-high", 1, 4),
				result("split-1-ladder-a"),
				result("split-1-ladder-b"),
				result("split-1-ladder-a", "L2-1"),
				result("split-1-ladder-b", "L2-1"),
			],
			eight(),
		),
		stage(
			"split-2-high",
			"Split 2",
			weeks,
			[standing("split-1-high", 1, 6), standing("split-1-mid", 1, 2)],
			rr(8, 2),
			{ parallelGroup: "split-2", anchor: "Bilibili Gaming" },
		),
		stage(
			"split-2-low",
			"Split 2",
			weeks,
			[standing("split-1-mid", 3, 4), standing("split-1-low", 1, 4)],
			rr(6),
			{ parallelGroup: "split-2", anchor: "LNG Esports" },
		),
		...[0, 1, 2, 3].map((i) =>
			stage(
				`split-2-playin-${i + 1}`,
				lplSplit2,
				/^Play-In$/,
				[standing("split-2-high", i + 5), standing("split-2-low", 4 - i)],
				single(5),
				{ parallelGroup: "split-2-playin", match: i + 1 },
			),
		),
		stage(
			"split-2-playoffs",
			lplSplit2,
			rounds,
			[
				standing("split-2-high", 1, 4),
				...[1, 2, 3, 4].map((i) => result(`split-2-playin-${i}`)),
			],
			eight(),
		),
		stage(
			"split-3-high",
			"Split 3",
			weeks,
			standing("split-2-playoffs", 1, 8),
			rr(8, 2),
			{ parallelGroup: "split-3", anchor: "Bilibili Gaming" },
		),
		stage(
			"split-3-low",
			"Split 3",
			weeks,
			[1, 2, 3, 4].map((i) => result(`split-2-playin-${i}`, "U1-1", "loser")),
			rr(4, 2),
			{ parallelGroup: "split-3", anchor: "LNG Esports" },
		),
		...twoSeries(
			"knights-road",
			lplGrand,
			/^Knight's Road$/,
			[
				[standing("split-3-high", 7), standing("split-3-low", 2)],
				[standing("split-3-high", 8), standing("split-3-low", 1)],
			],
			5,
		),
		stage(
			"grand-finals",
			lplGrand,
			rounds,
			[
				standing("split-3-high", 1, 6),
				result("knights-road-1"),
				result("knights-road-2"),
			],
			double(8, [[0, 0], [1, 1], [3]], [5, 5, 5, 5], [2]),
		),
	],
	qualifiers: [
		["split-1-playoffs", 2],
		["split-2-playoffs", 2],
		["grand-finals", 4],
	],
	notes: [
		"Split 1 pools retain the historical memberships and use the game's initial seeds within each pool. The observed tiebreak is handled by the generic cut tiebreak rule.",
		"Split 2 pools use split 1 regular-season ranks. Split 3 pools use the split 2 playoff field and the four play-in losers, as observed. The exact promotion rules and ladder seed order are unconfirmed.",
		"Worlds takes the Grand Finals top four; the snapshot shows a different fourth China qualifier.",
	],
};
