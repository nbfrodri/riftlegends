import { describe, expect, it } from "vitest";
import type { CommandHandler, Outcome } from "../server/dispatcher";
import { takeSides } from "../test/take-sides";
import { DRAFT_ORDER } from "./order";
import { initialSeries, type SeriesState, seriesCommands } from "./series";

const POOL = Array.from({ length: 40 }, (_, i) => `c${i}`);

type Accepted = Extract<Outcome<SeriesState>, { ok: true }>;
const run = (state: SeriesState, kind: string, payload: object) =>
	(
		seriesCommands[
			kind as keyof typeof seriesCommands
		] as CommandHandler<SeriesState>
	)(state, payload);
const ok = (outcome: Outcome<SeriesState>): Accepted => {
	if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
	return outcome;
};

/** A series with the timer on, its draft just started: the drawn team plays blue. */
const drafting = (seed = 5, timer = true) => {
	const { state } = ok(
		run(initialSeries, "series.start", {
			teams: ["t1", "geng"],
			format: "bo3",
			fearless: "hard",
			timer,
			pool: POOL,
			seed,
		}),
	);
	return takeSides(state, state.chooser as string);
};

/** Advances through the six first bans with timeouts. */
const toFirstPick = (state: SeriesState) => {
	let current = state;
	for (const _ of DRAFT_ORDER.slice(0, 6)) {
		current = ok(run(current, "draft.timeout", {})).state;
	}
	return current;
};

describe("timeouts", () => {
	it("leave an empty ban (T1)", () => {
		const outcome = ok(run(drafting(), "draft.timeout", {}));
		const blue = outcome.state.draft?.blue;
		expect(outcome.facts).toEqual([
			{
				type: "draft.banned",
				game: 1,
				team: blue,
				champion: null,
				timeout: true,
			},
		]);
	});

	it("pick a free champion with the RNG, the same for the same seed (T2)", () => {
		const pickWith = (seed: number) =>
			ok(run(toFirstPick(drafting(seed)), "draft.timeout", {})).facts[0];
		const first = pickWith(5);
		expect(first).toMatchObject({ type: "draft.picked", timeout: true });
		expect(pickWith(5)).toEqual(first);
		const champions = new Set(
			Array.from({ length: 20 }, (_, seed) => pickWith(seed)?.champion),
		);
		expect(champions.size).toBeGreaterThan(1);
	});

	it("never pick a champion that is taken (T2)", () => {
		for (let seed = 0; seed < 30; seed++) {
			let state = toFirstPick(drafting(seed));
			const picked = new Set<unknown>();
			for (const _ of DRAFT_ORDER.slice(6, 12)) {
				const outcome = ok(run(state, "draft.timeout", {}));
				const champion = outcome.facts[0]?.champion;
				expect(picked.has(champion)).toBe(false);
				picked.add(champion);
				state = outcome.state;
			}
		}
	});

	it("are rejected when the timer is off (T3)", () => {
		expect(run(drafting(5, false), "draft.timeout", {})).toEqual({
			ok: false,
			error: { code: "timer-off", params: {} },
		});
	});

	it("only apply to bans and picks", () => {
		let state = drafting();
		for (let i = 0; i < 20; i++)
			state = ok(run(state, "draft.timeout", {})).state;
		expect(run(state, "draft.timeout", {})).toMatchObject({
			ok: false,
			error: { code: "wrong-action", params: { expected: "roles" } },
		});
	});
});
