import { describe, expect, it } from "vitest";
import type { CommandHandler, Outcome } from "../server/dispatcher";
import { DRAFT_ORDER } from "./order";
import {
	finishGame,
	initialSeries,
	type SeriesState,
	seriesCommands,
} from "./series";

const T1 = "t1";
const GENG = "geng";
const POOL = Array.from({ length: 70 }, (_, i) => `c${i}`);

type Accepted = Extract<Outcome<SeriesState>, { ok: true }>;

const run = (
	state: SeriesState,
	kind: keyof typeof seriesCommands,
	payload: object,
) => (seriesCommands[kind] as CommandHandler<SeriesState>)(state, payload);

const ok = (outcome: Outcome<SeriesState>): Accepted => {
	if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
	return outcome;
};

const start = (extra: object = {}) =>
	ok(
		run(initialSeries, "series.start", {
			teams: [T1, GENG],
			seeds: [1, 2],
			format: "bo3",
			fearless: "hard",
			timer: false,
			pool: POOL,
			seed: 7,
			...extra,
		}),
	).state;

/** Picks the first champions each side can take; bans are empty. */
const draftGame = (state: SeriesState) => {
	let current = state;
	for (const step of DRAFT_ORDER) {
		const draft = current.draft;
		if (!draft) throw new Error("no draft");
		const team = draft[step.side];
		if (step.action === "ban") {
			current = ok(run(current, "draft.ban", { team, champion: null })).state;
			continue;
		}
		const taken = new Set([
			...current.previous.flatMap((game) => Object.values(game).flat()),
			...draft.picks.blue,
			...draft.picks.red,
		]);
		const champion = POOL.find((c) => !taken.has(c));
		current = ok(run(current, "draft.pick", { team, champion })).state;
	}
	for (const side of ["blue", "red"] as const) {
		const draft = current.draft;
		if (!draft) throw new Error("no draft");
		const [top, jungle, mid, bot, support] = draft.picks[side];
		current = ok(
			run(current, "draft.roles", {
				team: draft[side],
				roles: { top, jungle, mid, bot, support },
			}),
		).state;
	}
	return current;
};

const playGame = (state: SeriesState, winner: string) => {
	let current = state;
	if (current.phase === "side") {
		const chooser = current.chooser as string;
		current = ok(
			run(current, "side.choose", { team: chooser, side: "blue" }),
		).state;
	}
	current = draftGame(current);
	// The winner is set by hand: these tests check the series, not the game.
	return finishGame(current, winner);
};

describe("start", () => {
	it("records the series and lets the better seed choose the side (S2)", () => {
		const outcome = ok(
			run(initialSeries, "series.start", {
				teams: [T1, GENG],
				seeds: [2, 1],
				format: "bo1",
				fearless: "hard",
				timer: false,
				pool: POOL,
				seed: 7,
			}),
		);
		expect(outcome.facts.map((f) => f.type)).toEqual(["series.started"]);
		expect(outcome.state.phase).toBe("side");
		expect(outcome.state.chooser).toBe(GENG);
	});

	it("draws game 1's sides with the RNG when there are no seeds (S2)", () => {
		const draw = (seed: number) =>
			ok(
				run(initialSeries, "series.start", {
					teams: [T1, GENG],
					format: "bo1",
					fearless: "off",
					timer: false,
					pool: POOL,
					seed,
				}),
			);
		const first = draw(7);
		expect(first.facts.map((f) => f.type)).toEqual([
			"series.started",
			"side.chosen",
			"game.started",
		]);
		expect(first.facts[1]).toMatchObject({ game: 1, side: "blue", by: "draw" });
		expect(draw(7)).toEqual(first);
		const blues = new Set(
			Array.from({ length: 20 }, (_, seed) => draw(seed).state.draft?.blue),
		);
		expect(blues).toEqual(new Set([T1, GENG]));
	});

	it("rejects a pool too small for the worst case (F8)", () => {
		expect(
			run(initialSeries, "series.start", {
				teams: [T1, GENG],
				format: "bo5",
				fearless: "hard",
				timer: false,
				pool: POOL.slice(0, 59),
				seed: 1,
			}),
		).toEqual({
			ok: false,
			error: { code: "pool-too-small", params: { needed: 60, available: 59 } },
		});
	});

	it("happens only once", () => {
		expect(
			run(start(), "series.start", {
				teams: [T1, GENG],
				format: "bo1",
				fearless: "off",
				timer: false,
				pool: POOL,
				seed: 1,
			}),
		).toMatchObject({ ok: false, error: { code: "wrong-action" } });
	});

	it("must come before any other command", () => {
		expect(
			run(initialSeries, "draft.ban", { team: T1, champion: null }),
		).toMatchObject({ ok: false, error: { code: "wrong-action" } });
	});
});

describe("sides (S3)", () => {
	it("are chosen only by the team with the right to", () => {
		expect(
			run(start(), "side.choose", { team: GENG, side: "red" }),
		).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
	});

	it("start the game with the chosen side", () => {
		const outcome = ok(run(start(), "side.choose", { team: T1, side: "red" }));
		expect(outcome.facts).toEqual([
			{ type: "side.chosen", game: 1, team: T1, side: "red", by: "seed" },
			{ type: "game.started", game: 1, blue: GENG, red: T1 },
		]);
	});

	it("go to the loser of the previous game, and the draft waits for them", () => {
		const after = ok(playGame(start(), GENG)).state;
		expect(after.phase).toBe("side");
		expect(after.chooser).toBe(T1);
		expect(run(after, "draft.ban", { team: T1, champion: null })).toMatchObject(
			{ ok: false, error: { code: "wrong-action" } },
		);
		const chosen = ok(run(after, "side.choose", { team: T1, side: "blue" }));
		expect(chosen.facts[0]).toMatchObject({ game: 2, by: "choice" });
	});
});

describe("formats (S1)", () => {
	it.each([
		["bo1", [T1], [1, 0]],
		["bo3", [T1, GENG, T1], [2, 1]],
		["bo5", [GENG, GENG, GENG], [0, 3]],
	] as const)("%s ends at the needed wins", (format, winners, wins) => {
		let state = start({ format, pool: POOL });
		let last: Accepted | undefined;
		for (const winner of winners) {
			last = ok(playGame(state, winner));
			state = last.state;
		}
		expect(state.phase).toBe("over");
		expect(last?.facts.at(-1)).toEqual({
			type: "series.finished",
			winner: winners.at(-1),
			wins,
		});
	});
});

describe("champions", () => {
	it("are checked against the series rules", () => {
		const won = ok(playGame(start(), T1)).state;
		const game2 = ok(
			run(won, "side.choose", { team: GENG, side: "blue" }),
		).state;
		let state = game2;
		for (const step of DRAFT_ORDER.slice(0, 6)) {
			const team = state.draft?.[step.side] as string;
			state = ok(run(state, "draft.ban", { team, champion: null })).state;
		}
		// c0 was picked in game 1: hard fearless locks it for everyone.
		expect(run(state, "draft.pick", { team: GENG, champion: "c0" })).toEqual({
			ok: false,
			error: { code: "champion-unavailable", params: { champion: "c0" } },
		});
	});
});

describe("after the series (S4)", () => {
	it("every command is rejected", () => {
		const over = ok(playGame(start({ format: "bo1" }), T1)).state;
		for (const [kind, payload] of [
			["side.choose", { team: GENG, side: "blue" }],
			["draft.ban", { team: T1, champion: null }],
			["match.play", {}],
		] as const) {
			expect(run(over, kind, payload)).toEqual({
				ok: false,
				error: { code: "series-over", params: {} },
			});
		}
	});
});
