import type { AiContent, MatchContent } from "@rift-legends/contracts";
import { ROLES, type Role } from "@rift-legends/contracts";
import { type Fixed, mul, SCALE } from "../../math";
import type { MatchCause, MatchCauseKey } from "../cause-keys";
import {
	ATTRIBUTE_FACTORS,
	type Factors,
	type Lineup,
	type PlayerFactors,
	playerFactors,
	teamFactors,
} from "./factors";

export type { Lineup } from "./factors";

export const PHASES = ["early", "mid", "late"] as const;
export const CONTESTS = [
	"lane",
	"jungle",
	"fight",
	"objective",
	"siege",
] as const;

type Phase = (typeof PHASES)[number];
export type Contest = (typeof CONTESTS)[number];

export interface Scored {
	readonly total: number;
	/** Points each factor adds; they sum to `total`. */
	readonly causes: readonly MatchCause[];
}

export interface Profile {
	readonly phases: Readonly<Record<Phase, Scored>>;
	readonly contests: Readonly<Record<Contest, Scored>>;
	/** What each player brings to the attribute factors (see `liveCauses`). */
	readonly players: Readonly<Record<Role, PlayerFactors>>;
}

type FactorKey = MatchCauseKey | `${MatchCauseKey}.${Phase}`;
type Weights = Partial<Record<FactorKey, number>>;

/**
 * Percent of each factor in each contest and phase. A balance constant:
 * the calibration of plan 08 tunes it.
 */
const WEIGHTS: Record<Contest | Phase, Weights> = {
	lane: {
		lanes: 100,
		farming: 60,
		mechanics: 60,
		mastery: 60,
		matchup: 100,
		meta: 60,
		chemistry: 30,
	},
	jungle: {
		jungler: 100,
		roaming: 50,
		anticipation: 50,
		mastery: 40,
		meta: 40,
		chemistry: 40,
	},
	fight: {
		teamfight: 100,
		mechanics: 40,
		positioning: 60,
		communication: 50,
		mastery: 40,
		synergy: 100,
		damage: 100,
		frontline: 100,
		cc: 100,
		peel: 100,
		meta: 40,
		chemistry: 50,
	},
	objective: {
		macro: 100,
		jungler: 50,
		vision: 60,
		objectiveControl: 60,
		mastery: 20,
		meta: 20,
		chemistry: 50,
	},
	siege: {
		macro: 60,
		waves: 80,
		teamfight: 60,
		frontline: 50,
		damage: 50,
		mastery: 20,
		meta: 20,
		chemistry: 30,
	},
	early: {
		lanes: 80,
		farming: 40,
		mechanics: 60,
		jungler: 60,
		roaming: 40,
		anticipation: 40,
		matchup: 80,
		mastery: 40,
		meta: 40,
		chemistry: 30,
		"power.early": 100,
		"tempo.early": 100,
	},
	mid: {
		macro: 80,
		teamfight: 60,
		waves: 40,
		vision: 40,
		objectiveControl: 40,
		jungler: 30,
		synergy: 60,
		damage: 50,
		mastery: 40,
		meta: 40,
		chemistry: 40,
		"power.mid": 100,
	},
	late: {
		teamfight: 100,
		macro: 60,
		positioning: 50,
		communication: 40,
		synergy: 60,
		damage: 100,
		frontline: 50,
		mastery: 40,
		meta: 40,
		chemistry: 40,
		"power.late": 100,
		"tempo.late": 100,
	},
};

const PERCENT = (SCALE / 100) as Fixed;

function score(factors: Factors, weights: Weights): Scored {
	const causes = Object.entries(weights).map(([factor, weight]) => ({
		// "power.early" reads as "power" once it sits in a phase.
		key: (factor.split(".")[0] ?? factor) as MatchCauseKey,
		points: mul(factors[factor] ?? (0 as Fixed), (weight * PERCENT) as Fixed),
	}));
	return { total: causes.reduce((sum, c) => sum + c.points, 0), causes };
}

function profile(
	factors: Factors,
	players: Readonly<Record<Role, PlayerFactors>>,
): Profile {
	const pick = <K extends Contest | Phase>(keys: readonly K[]) =>
		Object.fromEntries(
			keys.map((key) => [key, score(factors, WEIGHTS[key])]),
		) as Record<K, Scored>;
	return { phases: pick(PHASES), contests: pick(CONTESTS), players };
}

/** The causes of a profile part that do not depend on who is up. */
export const staticCauses = (scored: Scored) =>
	scored.causes.filter(({ key }) => !ATTRIBUTE_FACTORS.has(key));

/**
 * The attribute causes of a contest or phase for the players that are up, with
 * `weights` per 10,000 by role: each factor is the weighted mean of the living
 * minus 50, so a player who is down adds nothing and never more than he is
 * worth (the values are never negative). With all five up and equal weights it
 * is the team average of the full profile (plan 08, #529).
 */
export function liveCauses(
	profile: Profile,
	part: Contest | Phase,
	weights: Readonly<Record<Role, number>>,
	up: readonly Role[],
): MatchCause[] {
	return Object.entries(WEIGHTS[part]).flatMap(([factor, weight]) => {
		const key = (factor.split(".")[0] ?? factor) as MatchCauseKey;
		if (!ATTRIBUTE_FACTORS.has(key)) return [];
		let value: number;
		if (key === "jungler") {
			// A contest that does not count the jungler (a lane) keeps his factor.
			value =
				up.includes("jungle") || weights.jungle === 0
					? (profile.players.jungle.jungler ?? 0)
					: 0;
		} else {
			value = 0;
			for (const role of ROLES) {
				if (up.includes(role)) {
					value += weights[role] * (profile.players[role][key] ?? 0);
				}
			}
			value = (value - (value % SCALE)) / SCALE;
		}
		return [
			{
				key,
				points: mul((value - 50 * SCALE) as Fixed, (weight * PERCENT) as Fixed),
			},
		];
	});
}

/** Strength of each team by phase and contest, with its breakdown (F1–F5). */
export function profiles(
	draft: AiContent,
	match: MatchContent,
	us: Lineup,
	them: Lineup,
): { us: Profile; them: Profile } {
	return {
		us: profile(
			teamFactors(draft, match, us, them),
			playerFactors(draft, match, us),
		),
		them: profile(
			teamFactors(draft, match, them, us),
			playerFactors(draft, match, them),
		),
	};
}

/** The totals `match.started` records. */
export function summarize({ phases, contests }: Profile) {
	const totals = <K extends string>(scored: Readonly<Record<K, Scored>>) =>
		Object.fromEntries(
			Object.entries<Scored>(scored).map(([key, s]) => [key, s.total]),
		) as Record<K, number>;
	return { phases: totals(phases), contests: totals(contests) };
}
