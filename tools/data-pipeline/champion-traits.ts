import { curated, type Traits } from "./champion-trait-data.ts";

export type { Kit } from "./champion-trait-data.ts";

const classDefaults: Readonly<Record<string, Traits>> = {
	assassin: ["melee", 0, [], [100, 0, 0], []],
	fighter: ["melee", 2, ["skillshot"], [100, 0, 0], ["duel"]],
	mage: ["ranged", 0, ["skillshot"], [0, 100, 0], ["skillshots"]],
	marksman: ["ranged", 0, [], [100, 0, 0], []],
	support: ["ranged", 1, ["skillshot"], [0, 100, 0], ["shield"]],
	tank: ["melee", 1, ["area"], [0, 100, 0], ["wombo"]],
};
const generic: Traits = ["melee", 1, [], [50, 50, 0], []];

/** Curated estimates; {@link kitTraits} replaces what the game data decides. */
export function estimatedTraits(id: string, classes: readonly string[]) {
	const traits = Object.hasOwn(curated, id) ? curated[id] : undefined;
	const fallback = classes.find((tag) => Object.hasOwn(classDefaults, tag));
	const [range, sustain, cc, split, kit, uncertain] =
		traits ?? (fallback ? classDefaults[fallback] : undefined) ?? generic;
	return {
		range,
		sustain,
		ccKinds: cc,
		split,
		kit,
		estimate: traits ? (uncertain ? "curation" : undefined) : "class",
	} as const;
}

/** Ids with curated traits, for the table review test. */
export const curatedTraitIds = Object.keys(curated);
