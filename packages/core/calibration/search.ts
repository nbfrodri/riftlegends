import type { Personality } from "@rift-legends/contracts";
import { type Fixed, max, min, mul, SCALE } from "../math";
import { shuffle } from "../rng/helpers";
import { deriveSeed } from "../rng/seeds";
import { createRng, type Rng } from "../rng/streams";
import { evaluate, type Report, type WeightMap } from "./metric";
import { COMPONENT_KEYS, type Turn } from "./replay";

/**
 * Weights under search: `base` is what every personality uses for the keys it
 * does not name; `own` are the multipliers that give each personality its character.
 */
export interface Setup {
	readonly base: WeightMap;
	readonly own: Readonly<Partial<Record<Personality, WeightMap>>>;
}

export interface Calibration {
	readonly setup: Setup;
	/** Whether the search found weights that improve top 3 on validation. */
	readonly accepted: boolean;
	readonly train: { before: Report; after: Report };
	readonly validation: { before: Report; after: Report };
}

export const resolver =
	(setup: Setup) =>
	(personality: Personality): WeightMap => ({
		...setup.base,
		...setup.own[personality],
	});

/** Steps tried on a weight, as fixed-point multipliers. */
const BASE_STEPS = [5_000, 7_500, 9_000, 11_000, 13_000, 20_000];
const OWN_STEPS = [8_000, 9_000, 11_000, 12_000];
const BASE_RANGE = [2_500, 40_000] as const;
/** A personality keeps its character: its own weights stay near where they started. */
const OWN_RANGE = [7_000, 14_000] as const;
const MIN_PERSONALITY_TURNS = 400;
const SWEEPS = 4;

const scaled = (value: number, by: number) => mul(value as Fixed, by as Fixed);

const score = (report: Report) =>
	report.overall.top3 * (report.overall.turns + 1) + report.overall.top1;

/** Coordinate descent: the best strictly improving step per weight, in a seeded order. */
function descend(
	turns: readonly Turn[],
	setup: Setup,
	slots: readonly { key: string; personality?: Personality }[],
	steps: readonly number[],
	range: (start: number) => readonly [number, number],
	rng: Rng,
): Setup {
	const startOf = (slot: (typeof slots)[number], from: Setup) =>
		(slot.personality
			? from.own[slot.personality]?.[slot.key]
			: from.base[slot.key]) ?? SCALE;
	const originals = new Map(slots.map((s) => [s, startOf(s, setup)]));
	const run = (s: Setup) => score(evaluate(turns, resolver(s)));
	const withWeight = (s: Setup, slot: (typeof slots)[number], value: number) =>
		slot.personality
			? {
					...s,
					own: {
						...s.own,
						[slot.personality]: {
							...s.own[slot.personality],
							[slot.key]: value,
						},
					},
				}
			: { ...s, base: { ...s.base, [slot.key]: value } };
	let best = setup;
	let bestScore = run(best);
	for (let sweep = 0; sweep < SWEEPS; sweep++) {
		let improved = false;
		for (const slot of shuffle(rng, slots)) {
			const current = startOf(slot, best);
			const [low, high] = range(originals.get(slot) as number);
			for (const step of steps) {
				const value = min(high, max(low, scaled(current, step)));
				if (value === current) continue;
				const candidate = withWeight(best, slot, value);
				const candidateScore = run(candidate);
				if (candidateScore > bestScore) {
					best = candidate;
					bestScore = candidateScore;
					improved = true;
				}
			}
		}
		if (!improved) break;
	}
	return best;
}

/**
 * Seeded, deterministic search for weights that predict pro drafts better.
 * The shipped weights change only if top 3 improves on the validation turns.
 */
export function calibrate(input: {
	train: readonly Turn[];
	validation: readonly Turn[];
	start: Setup;
	seed: number;
}): Calibration {
	const { train, validation, start } = input;
	const rng = createRng(deriveSeed(input.seed, 0xca1b));
	const report = (turns: readonly Turn[], setup: Setup) =>
		evaluate(turns, resolver(setup));
	const outcome = (setup: Setup, accepted: boolean): Calibration => ({
		setup,
		accepted,
		train: { before: report(train, start), after: report(train, setup) },
		validation: {
			before: report(validation, start),
			after: report(validation, setup),
		},
	});

	let tuned = descend(
		train,
		start,
		COMPONENT_KEYS.map((key) => ({ key })),
		BASE_STEPS,
		() => BASE_RANGE,
		rng,
	);
	const trainReport = report(train, tuned);
	for (const [personality, count] of Object.entries(
		trainReport.personalities,
	) as [Personality, { turns: number }][]) {
		const named = Object.keys(start.own[personality] ?? {});
		if (count.turns < MIN_PERSONALITY_TURNS || named.length === 0) continue;
		const mine = train.filter((t) => t.personality === personality);
		const own = descend(
			mine,
			tuned,
			named.map((key) => ({ key, personality })),
			OWN_STEPS,
			(from) => [scaled(from, OWN_RANGE[0]), scaled(from, OWN_RANGE[1])],
			rng,
		);
		// Keep a personality's changes only if its own validation turns do not get worse.
		const theirs = validation.filter((t) => t.personality === personality);
		const was = evaluate(theirs, resolver(tuned)).overall.top3;
		if (evaluate(theirs, resolver(own)).overall.top3 >= was) tuned = own;
	}

	const before = report(validation, start).overall.top3;
	const after = report(validation, tuned).overall.top3;
	return after > before ? outcome(tuned, true) : outcome(start, false);
}
