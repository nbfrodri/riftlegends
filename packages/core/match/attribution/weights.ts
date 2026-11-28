import type {
	ARCHETYPES,
	PlayerAttribute,
	Role,
} from "@rift-legends/contracts";

type Archetype = (typeof ARCHETYPES)[number];

/** Base weights per role, in order top, jungle, mid, bot, support (plan 08, R1). */
export const KILL_BASE: Readonly<Record<Role, number>> = {
	top: 36,
	jungle: 34,
	mid: 50,
	bot: 64,
	support: 10,
};
export const ASSIST_BASE: Readonly<Record<Role, number>> = {
	top: 8,
	jungle: 25,
	mid: 55,
	bot: 60,
	support: 400,
};

const KILL_FAVOURS: readonly Archetype[] = ["carry", "hypercarry", "dive"];
const KILL_OPPOSES: readonly Archetype[] = ["utility", "peel"];
const ASSIST_FAVOURS: readonly Archetype[] = ["engage", "peel", "utility"];
const ASSIST_OPPOSES: readonly Archetype[] = ["carry", "hypercarry"];

/** One factor moves a weight at most this much, in thousandths (0.75–1.25). */
const SWING = 250;
/** Thousandths per point of the two attributes' sum away from 100. */
const PER_POINT = 3;

type Attributes = Pick<
	Record<PlayerAttribute, number>,
	"mechanics" | "positioning" | "communication" | "teamfight"
>;

const clamp = (value: number, low: number, high: number) =>
	value < low ? low : value > high ? high : value;

/** 1,000 ± `SWING`: up if the champion fits, down if it is the opposite. */
function archetypeFactor(
	archetypes: readonly Archetype[],
	favours: readonly Archetype[],
	opposes: readonly Archetype[],
) {
	const fits = archetypes.filter((a) => favours.includes(a)).length > 0 ? 1 : 0;
	const clashes =
		archetypes.filter((a) => opposes.includes(a)).length > 0 ? 1 : 0;
	return 1000 + SWING * (fits - clashes);
}

/** 1,000 ± `SWING`, centred on an average of 50 in the two attributes. */
const attributeFactor = (a: number, b: number) =>
	clamp(1000 + (a + b - 100) * PER_POINT, 1000 - SWING, 1000 + SWING);

/**
 * Integer weights of a role to score or to help a kill: the role's base times
 * the archetype and attribute factors (each in thousandths).
 */
export function roleWeights(
	role: Role,
	archetypes: readonly Archetype[],
	attributes: Attributes,
) {
	return {
		kill:
			KILL_BASE[role] *
			archetypeFactor(archetypes, KILL_FAVOURS, KILL_OPPOSES) *
			attributeFactor(attributes.mechanics, attributes.positioning),
		assist:
			ASSIST_BASE[role] *
			archetypeFactor(archetypes, ASSIST_FAVOURS, ASSIST_OPPOSES) *
			attributeFactor(attributes.communication, attributes.teamfight),
	};
}
