import { ROLES, type Side } from "@rift-legends/contracts";
import { SCALE } from "../../math";
import { clamp } from "../../math/int";
import { int, shuffle } from "../../rng/helpers";
import { SCOPES } from "../../rng/scopes";
import { deriveSeed } from "../../rng/seeds";
import { createRng } from "../../rng/streams";
import type { MatchCause } from "../cause-keys";
import { isAlive } from "../player-state";
import { type MatchState, other } from "../state";
import { roll } from "./contest";

/** The team that controls the pit is starting the objective. Only the rival
 * jungler comes to steal; the rest of that team is outside this contest. */
export function trySteal(
	state: MatchState,
	controllingSide: Side,
	contest: number,
	at: number,
) {
	const { seed, game } = state.context;
	const rng = createRng(
		deriveSeed(seed, SCOPES.matchSteal, game, state.minute, contest),
	);
	const side = other(controllingSide);
	// Only a jungler who is up comes to steal.
	if (!isAlive(state, side, "jungle", at)) return undefined;
	const attacker = state.context[side];
	const defender = state.context[controllingSide];
	const defenders = int(rng, 2, ROLES.length);
	const opposingSmite = shuffle(rng, ROLES)
		.slice(0, defenders)
		.includes("jungle");
	const smite = attacker.smite - (opposingSmite ? defender.smite : 132);
	const vision =
		attacker.vision.jungle +
		attacker.vision.support -
		defender.vision.jungle -
		defender.vision.support;
	// The terms are in basis points. Defenders screen access, while the
	// defending jungler can also secure the objective with their own Smite.
	const reasons: MatchCause[] = [
		{ key: "stealOpening", points: 205 },
		{ key: "stealSmite", points: smite * 2 },
		{ key: "stealVision", points: vision * 2 },
		{ key: "stealDefenders", points: -(defenders - 2) * 26 },
		{ key: "stealOpposingSmite", points: opposingSmite ? -45 : 0 },
	];
	const raw = reasons.reduce((sum, { points }) => sum + points, 0);
	const chance = clamp(raw, 0, SCALE);
	if (!roll(rng, chance)) return undefined;
	return {
		side,
		chance,
		causes: reasons.filter(({ points }) => points !== 0),
		steal: {
			jungler: attacker.players.jungle,
			controllingSide,
			defenders,
			opposingSmite,
		},
	};
}
