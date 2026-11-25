import {
	type AiContent,
	type MatchContent,
	type PlayerAttribute,
	ROLES,
	type Side,
} from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { type Fixed, max, min, mul, SCALE } from "../math";
import type { MatchCause, MatchCauseKey } from "./cause-keys";
import type { Contest, Lineup, Scored } from "./profile";

// Mental and series layer of plan 08 (F6-F12 and focus). Pure and without
// RNG: the loop adds these points to its contests and uses `variance` to
// widen or narrow its rolls.

export interface SeriesContext {
	/** 1-based. */
	readonly game: number;
	/** Last possible game of the series, or an elimination. */
	readonly decisive: boolean;
	readonly stage: "regular" | "playoffs" | "final" | "international";
	/** This team's earlier results in the series, the latest last. */
	readonly results: readonly ("win" | "loss")[];
	/** After a loss: the contest where the rival gained the most. */
	readonly rivalEdge?: Contest;
}

export interface MentalEdge {
	/** Adds to every contest and phase. */
	readonly general: Scored;
	/** Shotcalling and adaptation, only where they apply. */
	readonly byContest: Partial<Record<Contest, Scored>>;
	/** Performance variance of the team, per 10,000 (10,000 is normal). */
	readonly variance: number;
}

// Balance constants (plan 08 calibration tunes them). Percent weights apply
// to how far a team average is above 50; the other points are fixed point.
const PERCENT = (SCALE / 100) as Fixed;
const COMPOSURE_PERCENT = 20;
const FOCUS_PERCENT = 20;
const SHOTCALLING_PERCENT = 30;
const ADAPTATION_PERCENT = 30;
/** Points for winning the previous game. */
const WIN_CONFIDENCE = 8_000;
/** Points lost after two defeats in a row, before resilience softens them. */
const SLUMP = 30_000;
/** Pressure points by stage; experience softens them. */
const PRESSURE = {
	regular: 0,
	playoffs: 20_000,
	final: 40_000,
	international: 40_000,
} as const;
/** From this game on, focus counts. */
const FOCUS_FROM_GAME = 4;
/** Variance change per point of average consistency below 50. */
const VARIANCE_PER_POINT = 100;
const VARIANCE_MIN = 5_000;
const VARIANCE_MAX = 20_000;

const cause = (key: MatchCauseKey, points: number): MatchCause => ({
	key,
	points,
});
const scored = (causes: MatchCause[]): Scored => ({
	total: causes.reduce((t, c) => t + c.points, 0),
	causes,
});
/** Average of five values above 50, in fixed point (exact). */
const centred = (sum: number) => ((sum - 250) * (SCALE / 5)) as Fixed;
const percent = (value: Fixed, weight: number) =>
	mul(value, (weight * PERCENT) as Fixed);

/** Mental edge of a team in a game of a series, with its causes. */
export function mentalEdge(
	draft: AiContent,
	match: MatchContent,
	lineup: Lineup,
	side: Side,
	context: SeriesContext,
): MentalEdge {
	const roster = indexContent(draft).rosters.get(lineup.team);
	const players = ROLES.map((role) => {
		const id = roster?.get(role)?.id;
		const rated = match.players.find((p) => p.id === id);
		if (!rated) throw new Error(`No match data for ${lineup.team} in ${role}`);
		return rated;
	});
	const team = match.teams.find((t) => t.id === lineup.team);
	if (!team) throw new Error(`No match data for team ${lineup.team}`);

	const total = (key: PlayerAttribute) =>
		players.reduce((sum, p) => sum + p.attributes[key], 0);
	const last = context.results.at(-1);
	const slump = context.results.slice(-2).join() === "loss,loss";
	const pressured = context.decisive || context.stage !== "regular";

	const general = scored([
		cause("side", side === "blue" ? match.rules.blueSide : 0),
		cause(
			"composure",
			pressured ? percent(centred(total("composure")), COMPOSURE_PERCENT) : 0,
		),
		cause(
			"momentum",
			last === "win"
				? WIN_CONFIDENCE
				: slump
					? -(SLUMP / 500) * (500 - total("resilience"))
					: 0,
		),
		cause(
			"experience",
			-(PRESSURE[context.stage] / 500) * (500 - total("experience")),
		),
		cause(
			"focus",
			context.game >= FOCUS_FROM_GAME
				? percent(centred(total("focus")), FOCUS_PERCENT)
				: 0,
		),
	]);

	const byContest: Partial<Record<Contest, Scored>> = {};
	const leader = players.find((p) => p.leader);
	if (leader) {
		const points = percent(
			centred(leader.attributes.shotcalling * 5),
			SHOTCALLING_PERCENT,
		);
		byContest.objective = scored([cause("shotcalling", points)]);
		byContest.fight = scored([cause("shotcalling", points)]);
	}
	if (context.rivalEdge && last === "loss") {
		const adaptation = percent(
			centred(team.adaptation * 5),
			ADAPTATION_PERCENT,
		);
		const known = byContest[context.rivalEdge];
		byContest[context.rivalEdge] = scored([
			...(known?.causes ?? []),
			cause("adaptation", adaptation),
		]);
	}

	const variance = min(
		VARIANCE_MAX,
		max(
			VARIANCE_MIN,
			SCALE + (250 - total("consistency")) * (VARIANCE_PER_POINT / 5),
		),
	);
	return { general, byContest, variance };
}
