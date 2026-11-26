import type { Role } from "@rift-legends/contracts";
import { clamp } from "../math/int";

// Common rating of plan 08 (#348): 0–100 with 60 as the reference of the
// role. Each metric is placed between three anchors (P10 → 0, reference → 60,
// P90 → 100, reversed for deaths), so the same relative performance gives
// the same rating in every role. Integers only; rounds once at the end.

export type Metric =
	| "damage"
	| "kills"
	| "kp"
	| "assists"
	| "deaths"
	| "pressure"
	| "objectives"
	| "vision";

/** Values that score 0, 60 and 100. `low` is above `high` when less is better. */
export interface Anchors {
	low: number;
	mid: number;
	high: number;
}

/** Approved on 2026-11-23 (jungle changed by the user on 2026-11-25): the weight of each metric, in percent. */
export const WEIGHTS: Record<Role, Partial<Record<Metric, number>>> = {
	top: { damage: 40, pressure: 35, deaths: 25 },
	jungle: { kp: 40, objectives: 32, deaths: 18, vision: 10 },
	mid: { damage: 45, kills: 30, deaths: 25 },
	bot: { damage: 45, kills: 30, deaths: 25 },
	support: { kp: 35, assists: 25, deaths: 20, vision: 20 },
};

/**
 * Anchors per role. `low` and `high` are the pro P10 and P90 (Leaguepedia,
 * 4,756 teams of six leagues; plan 08). `mid` is the reference that scores 60:
 * the simulated mean would score under 60 on a bent scale (more room above the
 * reference than below it), so it is set where the mean of the simulation
 * scores 60 (calibration of 2026-11-25, K8). Shares are per 10,000 of the team
 * (or of the chances); assists and deaths are hundredths per 30 minutes;
 * vision is the vision score per 30 minutes.
 */
export const ANCHORS: Record<Role, Partial<Record<Metric, Anchors>>> = {
	top: {
		damage: { low: 1469, mid: 2215, high: 3054 },
		pressure: { low: 0, mid: 4675, high: 10_000 },
		deaths: { low: 500, mid: 325, high: 14 },
	},
	jungle: {
		kp: { low: 5000, mid: 6490, high: 9333 },
		objectives: { low: 0, mid: 4600, high: 10_000 },
		deaths: { low: 393, mid: 105, high: 0 },
		vision: { low: 40, mid: 54, high: 69 },
	},
	mid: {
		damage: { low: 1755, mid: 2425, high: 3231 },
		kills: { low: 417, mid: 2035, high: 4545 },
		deaths: { low: 503, mid: 315, high: 30 },
	},
	bot: {
		damage: { low: 2003, mid: 2740, high: 3650 },
		kills: { low: 833, mid: 2570, high: 5000 },
		deaths: { low: 515, mid: 300, high: 37 },
	},
	support: {
		kp: { low: 5000, mid: 6630, high: 9444 },
		assists: { low: 107, mid: 565, high: 1478 },
		deaths: { low: 389, mid: 110, high: 0 },
		vision: { low: 103, mid: 127, high: 151 },
	},
};

export interface RatingPart {
	metric: Metric;
	/** The measured value; null without opportunities. */
	value: number | null;
	/** 0 to 10,000 (hundredths of a rating point); 6,000 is the reference. */
	score: number;
	/** Percent. */
	weight: number;
}

const NEUTRAL = 6000;

/** Integer division of non-negative numbers, rounding half to even. */
function divRound(n: number, d: number): number {
	const q = (n - (n % d)) / d;
	const twice = 2 * (n % d);
	return twice < d || (twice === d && q % 2 === 0) ? q : q + 1;
}

/** Score in hundredths of a point, from the anchors; clamped to 0–10,000. */
function scoreOf(value: number, { low, mid, high }: Anchors): number {
	// Reverse the axis when less is better so the anchors always ascend.
	const sign = low > high ? -1 : 1;
	const [v, lo, md, hi] = [value, low, mid, high].map((n) => n * sign) as [
		number,
		number,
		number,
		number,
	];
	if (v <= lo) return 0;
	if (v >= hi) return 10_000;
	return v <= md
		? divRound(NEUTRAL * (v - lo), md - lo)
		: NEUTRAL + divRound((10_000 - NEUTRAL) * (v - md), hi - md);
}

/** `won` of `total` chances per 10,000; null without chances. */
export function share(won: number, total: number): number | null {
	return total === 0 ? null : divRound(won * 10_000, total);
}

/** A count over `seconds` as hundredths per 30 minutes; null without time. */
export function per30(count: number, seconds: number): number | null {
	return seconds <= 0 ? null : divRound(count * 180_000, seconds);
}

/**
 * Rating of a player from the metrics its role weighs. A missing or null
 * metric counts as the neutral 60; anything else is ignored.
 */
export function rate(
	role: Role,
	values: Partial<Record<Metric, number | null>>,
): { rating: number; parts: RatingPart[] } {
	const parts = (Object.keys(WEIGHTS[role]) as Metric[]).map((metric) => {
		const value = values[metric] ?? null;
		const anchors = ANCHORS[role][metric] as Anchors;
		return {
			metric,
			value,
			score: value === null ? NEUTRAL : scoreOf(value, anchors),
			weight: WEIGHTS[role][metric] as number,
		};
	});
	const total = parts.reduce((sum, p) => sum + p.score * p.weight, 0);
	return { rating: clamp(divRound(total, 10_000), 0, 100), parts };
}
