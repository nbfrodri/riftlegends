import type { MatchEvent, Side } from "@rift-legends/contracts";
import { int } from "../../rng/helpers";
import type { Rng } from "../../rng/streams";
import type { MatchState } from "../state";

/** An event as a contest makes it; the loop adds the game and minute. */
export type ContestEvent = Omit<MatchEvent, "game" | "minute">;

/** A kind of contest the loop resolves when it is due, with its own RNG. */
export interface Contest {
	/** Fixed forever: it feeds the seed of the contest's stream. */
	readonly id: number;
	readonly due: (state: MatchState) => boolean;
	readonly resolve: (state: MatchState, rng: Rng) => ContestEvent[];
}

/** True with `chance` per 10,000. */
export const roll = (rng: Rng, chance: number) => int(rng, 0, 9999) < chance;

/** `amount` of gold to `side` and none to the other. */
export const paid = (side: Side, amount: number) =>
	side === "blue" ? { blue: amount, red: 0 } : { blue: 0, red: amount };
