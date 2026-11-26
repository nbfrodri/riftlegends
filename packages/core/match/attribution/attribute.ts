import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import { weighted } from "../../rng/helpers";
import { SCOPES } from "../../rng/scopes";
import { deriveSeed } from "../../rng/seeds";
import { createRng } from "../../rng/streams";
import type { Lane, MatchState } from "../state";

/** What kind of exchange a kill came from, which bounds who can take part. */
export type Engagement =
	| { kind: "duel"; lane: "top" | "mid" }
	| { kind: "duo" }
	| { kind: "gank"; lane: Lane }
	| { kind: "skirmish" }
	| { kind: "teamfight" };

/** Where the kill is in the game: contest id, event and kill within the event. */
export interface KillSlot {
	readonly contest: number;
	readonly event: number;
	readonly kill: number;
}

/**
 * Weight of each assist count, from the smallest. A balance constant that
 * K6 (plan 08) tunes: team fights are the most probable at three.
 */
const COUNTS = {
	duo: { first: 0, weights: [5, 95] },
	gank: { first: 1, weights: [20, 80] },
	skirmish: { first: 1, weights: [20, 80] },
	teamfight: { first: 2, weights: [5, 30, 65] },
} as const;
/** Gankers score twice as often as the laner they visit. */
const GANKER = 1;

function local(engagement: Engagement): readonly Role[] {
	switch (engagement.kind) {
		case "duel":
			return [engagement.lane];
		case "duo":
			return ["bot", "support"];
		case "gank":
			return engagement.lane === "bot"
				? ["jungle", "bot", "support"]
				: ["jungle", engagement.lane];
		default:
			return ROLES;
	}
}

/** Picks one of `roles` by weight; returns it and the rest. */
function draw(
	rng: ReturnType<typeof createRng>,
	roles: readonly Role[],
	weight: (role: Role) => number,
) {
	const index = weighted(rng, roles.map(weight));
	return {
		role: roles[index] as Role,
		rest: roles.filter((_, i) => i !== index),
	};
}

/**
 * Chooses the author and the assistants of one kill scored by `side`: both
 * come from the roles of the engagement, by role, champion and attributes
 * (plan 08, R1). No role repeats within a kill. It draws from its own stream
 * `(seed, matchAttribution, game, minute, contest, event, kill)`, so it never
 * moves the draws that resolve the contest. `alive` limits it to the players
 * who are up (plan 08, #528): the caller makes sure the exchange has some.
 */
export function attribute(
	state: MatchState,
	side: Side,
	engagement: Engagement,
	slot: KillSlot,
	alive: readonly Role[] = ROLES,
): { killer: Role; assists: Role[] } {
	const { seed, game } = state.context;
	const weights = state.context[side].attribution;
	const roles = local(engagement).filter((role) => alive.includes(role));
	if (engagement.kind === "duel") {
		return { killer: engagement.lane, assists: [] };
	}
	const rng = createRng(
		deriveSeed(
			seed,
			SCOPES.matchAttribution,
			game,
			state.minute,
			slot.contest,
			slot.event,
			slot.kill,
		),
	);
	const gank = engagement.kind === "gank";
	const author = draw(
		rng,
		roles,
		(role) => weights[role].kill * (gank && role === "jungle" ? GANKER : 1),
	);
	const counts = COUNTS[engagement.kind];
	const asked = counts.first + weighted(rng, [...counts.weights]);
	// A gank always brings the jungler into that lane. Reserve their assist
	// when the normal draw would omit them, keeping the size of the assist bag.
	const assists: Role[] = [];
	let rest = author.rest;
	while (assists.length < asked && rest.length > 0) {
		const next = draw(rng, rest, (role) => weights[role].assist);
		assists.push(next.role);
		rest = next.rest;
	}
	if (gank && author.role !== "jungle" && !assists.includes("jungle")) {
		// Takes the place of the last assist, or comes alone if the draw had none.
		if (assists.length > 0) assists[assists.length - 1] = "jungle";
		else assists.push("jungle");
	}
	return { killer: author.role, assists };
}
