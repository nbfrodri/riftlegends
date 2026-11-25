import type { Personality } from "@rift-legends/contracts";
import { SCALE } from "../math";
import { COMPONENT_KEYS, PHASES, type Phase, type Turn } from "./replay";

/** Fixed-point weights per component key; a missing key weighs ×1. */
export type WeightMap = Readonly<Partial<Record<string, number>>>;
export type Resolve = (personality: Personality) => WeightMap;

export interface Tally {
	turns: number;
	top1: number;
	top3: number;
}

export interface Report {
	overall: Tally;
	phases: Record<Phase, Tally>;
	leagues: Record<string, Tally>;
	personalities: Partial<Record<Personality, Tally>>;
}

const K = COMPONENT_KEYS.length;

/** `mul` on plain numbers: exact below 2^53 and rounds half to even. */
export function fastMul(a: number, b: number): number {
	const product = a * b;
	const rest = ((product % SCALE) + SCALE) % SCALE;
	const quotient = (product - rest) / SCALE;
	const up = rest * 2 > SCALE || (rest * 2 === SCALE && quotient % 2 !== 0);
	return (up ? quotient + 1 : quotient) + 0;
}

const column = (weights: WeightMap) =>
	COMPONENT_KEYS.map((key) => weights[key] ?? SCALE);

function rankWith(turn: Turn, weights: readonly number[]): number {
	const { points, candidates } = turn;
	const totals = new Array<number>(candidates.length);
	for (let row = 0; row < candidates.length; row++) {
		let total = 0;
		for (let k = 0; k < K; k++) {
			const value = points[row * K + k] as number;
			if (value !== 0) total += fastMul(value, weights[k] as number);
		}
		totals[row] = total;
	}
	const mine = totals[turn.actual] as number;
	const id = candidates[turn.actual] as string;
	let rank = 1;
	for (let row = 0; row < candidates.length; row++) {
		const other = totals[row] as number;
		if (other > mine || (other === mine && (candidates[row] as string) < id))
			rank++;
	}
	return rank;
}

/** Place of the real choice among the AI's candidates, 1 being its favourite (ties by id). */
export const rankOf = (turn: Turn, resolve: Resolve): number =>
	rankWith(turn, column(resolve(turn.personality)));

const tally = (): Tally => ({ turns: 0, top1: 0, top3: 0 });

function count(into: Tally, rank: number) {
	into.turns++;
	if (rank === 1) into.top1++;
	if (rank <= 3) into.top3++;
}

/** Top-1 and top-3 hits of the real choices, in total and by phase, league and personality. */
export function evaluate(turns: readonly Turn[], resolve: Resolve): Report {
	const report: Report = {
		overall: tally(),
		phases: Object.fromEntries(
			PHASES.map((p) => [p, tally()]),
		) as Report["phases"],
		leagues: {},
		personalities: {},
	};
	const columns = new Map<Personality, number[]>();
	for (const turn of turns) {
		let weights = columns.get(turn.personality);
		if (!weights) {
			weights = column(resolve(turn.personality));
			columns.set(turn.personality, weights);
		}
		const rank = rankWith(turn, weights);
		count(report.overall, rank);
		count(report.phases[turn.phase], rank);
		const league = report.leagues[turn.league] ?? tally();
		report.leagues[turn.league] = league;
		count(league, rank);
		const personality = report.personalities[turn.personality] ?? tally();
		report.personalities[turn.personality] = personality;
		count(personality, rank);
	}
	return report;
}
