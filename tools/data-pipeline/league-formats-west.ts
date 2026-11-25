import {
	asymmetricSix,
	eight,
	type LeagueDefinition,
	lowerEntrySix,
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

export const lec: LeagueDefinition = {
	stages: [
		stage("versus", "Versus Season", weeks, "roster", rr(10, 1, 1)),
		stage(
			"versus-playoffs",
			"Versus Playoffs",
			rounds,
			standing("versus", 1, 8),
			eight(3),
		),
		stage("spring", "Spring Season", weeks, "roster", rr(10)),
		stage(
			"spring-playoffs",
			"Spring Playoffs",
			rounds,
			standing("spring", 1, 6),
			lowerEntrySix(),
		),
		stage("summer", "Summer Season", weeks, "roster", rr(10)),
		stage(
			"summer-playoffs",
			"Summer Playoffs",
			rounds,
			standing("summer", 1, 6),
			lowerEntrySix(),
		),
	],
	qualifiers: [
		["versus-playoffs", 1],
		["spring-playoffs", 2],
		["summer-playoffs", 3],
	],
	notes: [
		"Versus removes two split-only guests: 10 teams and 45 Bo1 instead of 12 teams and 66 Bo1.",
	],
};

const lockIn = "Lock-In";
export const lcs: LeagueDefinition = {
	stages: [
		stage("lock-in-swiss", lockIn, /^Swiss Round \d+$/, "roster", swiss(3, 3)),
		stage(
			"lock-in-last-chance",
			lockIn,
			/^Last Chance$/,
			standing("lock-in-swiss", 6, 7),
			single(1),
		),
		stage(
			"lock-in-playoffs",
			lockIn,
			/^Playoffs Round \d+$|^Finals$/,
			[standing("lock-in-swiss", 1, 5), result("lock-in-last-chance")],
			lowerEntrySix(),
		),
		stage("spring", "Spring Season", weeks, "roster", rr(8)),
		stage(
			"spring-playoffs",
			"Spring Playoffs",
			rounds,
			standing("spring", 1, 6),
			lowerEntrySix(),
		),
		stage("summer", "Summer Season", weeks, "roster", rr(8)),
		stage(
			"summer-playoffs",
			"Summer Playoffs",
			rounds,
			standing("summer", 1, 6),
			asymmetricSix(),
		),
	],
	qualifiers: [
		["lock-in-playoffs", 1],
		["spring-playoffs", 2],
		["summer-playoffs", 3],
	],
	notes: [
		"Lock-In Last Chance uses places 6 and 7 of the game's three-round Swiss table.",
	],
};

const cup = "Cup";
export const cblol: LeagueDefinition = {
	stages: [
		stage("cup", cup, weeks, "roster", rr(8, 1, 1)),
		...twoSeries(
			"cup-playin",
			cup,
			/^Play-In Round 1$/,
			[
				[standing("cup", 5), standing("cup", 6)],
				[standing("cup", 7), standing("cup", 8)],
			],
			3,
		),
		stage(
			"cup-last-chance",
			cup,
			/^Play-In Last Chance$/,
			[result("cup-playin-1", "U1-1", "loser"), result("cup-playin-2")],
			single(5),
		),
		stage(
			"cup-playoffs",
			cup,
			rounds,
			[
				standing("cup", 1, 4),
				result("cup-playin-1"),
				result("cup-last-chance"),
			],
			asymmetricSix(3),
		),
		stage("split-1", "Split 1", weeks, "roster", rr(8)),
		stage(
			"split-1-playoffs",
			"Split 1 Playoffs",
			rounds,
			standing("split-1", 1, 6),
			asymmetricSix(),
		),
		stage("split-2", "Split 2", weeks, "roster", rr(8)),
		stage(
			"split-2-playoffs",
			"Split 2 Playoffs",
			rounds,
			standing("split-2", 1, 6),
			asymmetricSix(),
		),
	],
	qualifiers: [
		["cup-playoffs", 1],
		["split-1-playoffs", 1],
		["split-2-playoffs", 2],
	],
	notes: [
		"Cup play-in assigns the first direct playoff seed to the winner of fifth vs sixth.",
	],
};
