import type { MatchContent, MatchEvent, Side } from "@rift-legends/contracts";

/** Minutes each buff lasts after its objective falls. */
const BUFF_MINUTES = { herald: 2, baron: 3, elder: 2 } as const;
/** The counter each buffing objective adds to. */
const TAKEN = { herald: "heralds", baron: "barons", elder: "elders" } as const;

type Objective = "dragon" | "herald" | "baron" | "elder";

/** A side's dragons that complete its soul and end the dragons. */
export const SOUL = 4;

/** Void grubs in the one group; with all of them a side gets the voidmites. */
export const GRUBS = 3;

export interface SideObjectives {
	readonly dragons: number;
	/** Void grubs this side has taken; the stacks never wear off. */
	readonly grubs: number;
	/** Objectives this side has taken. */
	readonly heralds: number;
	readonly barons: number;
	readonly elders: number;
	/** Minute each buff wears off; 0 if the side never had it. */
	readonly buffs: Readonly<Record<keyof typeof BUFF_MINUTES, number>>;
}

export type ObjectiveTimers = Readonly<Record<Objective | "grub", number>>;

/** The minute in which `seconds` falls: an objective at 5:00 is up in minute 5. */
export const minuteOf = (seconds: number) =>
	(seconds + 59 - ((seconds + 59) % 60)) / 60;

export function startObjectives(
	objectives: MatchContent["rules"]["objectives"],
): ObjectiveTimers {
	return {
		grub: minuteOf(objectives.grub.first),
		dragon: minuteOf(objectives.dragon.first),
		herald: minuteOf(objectives.herald.first),
		baron: minuteOf(objectives.baron.first),
		elder: minuteOf(objectives.elder.first),
	};
}

export function markObjective<T extends SideObjectives>(
	won: T,
	lost: T,
	objectives: ObjectiveTimers,
	e: MatchEvent,
	loserSide: Side,
	rules: MatchContent["rules"]["objectives"],
) {
	const respawn = (kind: Objective) => ({
		...objectives,
		[kind]: e.minute + minuteOf(rules[kind].respawn),
	});
	const buff = (kind: keyof typeof BUFF_MINUTES) => ({
		...won.buffs,
		[kind]: e.minute + BUFF_MINUTES[kind],
	});
	switch (e.kind) {
		case "grub":
			// One group, so there is nothing to respawn; a split gives the
			// other side its share.
			won = { ...won, grubs: won.grubs + (e.grubs?.[e.side] ?? 0) };
			lost = { ...lost, grubs: lost.grubs + (e.grubs?.[loserSide] ?? 0) };
			break;
		case "dragon":
			won = { ...won, dragons: won.dragons + 1 };
			objectives = respawn("dragon");
			break;
		case "herald":
		case "baron":
		case "elder":
			won = {
				...won,
				[TAKEN[e.kind]]: won[TAKEN[e.kind]] + 1,
				buffs: buff(e.kind),
			};
			objectives = respawn(e.kind);
			break;
	}
	return { won, lost, objectives };
}
