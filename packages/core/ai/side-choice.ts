import type { AiSettings, SideChoice } from "@rift-legends/contracts";
import type { Rng } from "../rng/streams";
import { choose, difficultyOf } from "./choose";
import type { Component } from "./context";
import { PROFILES } from "./profiles";

/**
 * What each side choice is worth before the personality weighs it (fixed
 * point, plan 05). First pick secures a flexible or top-tier champion; last
 * pick answers the rival's final pick; blue is the map side the match rules
 * favour. Red is only what is left.
 */
const WORTH: Record<SideChoice, readonly Component[]> = {
	blue: [{ key: "blueSide", points: 12_000 }],
	red: [],
	first: [
		{ key: "flex", points: 8_000 },
		{ key: "meta", points: 6_000 },
	],
	last: [{ key: "matchup", points: 13_000 }],
};

export interface SideDecision {
	readonly choice: SideChoice;
	readonly total: number;
	readonly components: readonly Component[];
	readonly alternatives: readonly {
		choice: SideChoice;
		total: number;
		chance: number;
	}[];
}

/**
 * The AI's side choice (issue #305): the same draw as a draft decision
 * (plan 07), so the personality weighs each option and the difficulty sets
 * how surely it takes its favourite.
 */
export const decideSide = (
	rng: Rng,
	options: readonly SideChoice[],
	settings: AiSettings,
): SideDecision => {
	const decision = choose(
		rng,
		options.map((choice) => ({ champion: choice, components: WORTH[choice] })),
		PROFILES[settings.personality],
		difficultyOf(settings),
	);
	return {
		choice: decision.champion as SideChoice,
		total: decision.total,
		components: decision.components,
		alternatives: decision.alternatives.map(({ champion, ...rest }) => ({
			choice: champion as SideChoice,
			...rest,
		})),
	};
};
