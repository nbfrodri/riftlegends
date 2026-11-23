import { CONTRACT_VERSION, draftView } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { pick } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { CommandHandler, Outcome } from "../server/dispatcher";
import { openSession, type Session } from "../server/dispatcher";
import { turn } from "./game";
import { draftDispatcher, draftStateWith } from "./index";
import { DRAFT_ORDER } from "./order";
import {
	finishGame,
	initialSeries,
	type SeriesState,
	seriesCommands,
} from "./series";
import { viewDraft } from "./view";

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

const start = (seed = 7) =>
	ok(
		run(initialSeries, "series.start", {
			teams: [T1, GENG],
			format: "bo3",
			fearless: "off",
			timer: false,
			pool: POOL,
			seed,
		}),
	);

const rival = (team: string) => (team === T1 ? GENG : T1);

describe("priority (issue #305)", () => {
	it("game 1 is drawn with the core RNG, without seeding", () => {
		const outcome = start(7);
		expect(outcome.facts.map((f) => f.type)).toEqual(["series.started"]);
		expect(outcome.state.phase).toBe("side");
		const drawn = pick(createRng(deriveSeed(7, SCOPES.draft, 0)), [T1, GENG]);
		expect(outcome.state.chooser).toBe(drawn);
		expect(start(7)).toEqual(outcome);
		const choosers = new Set(
			Array.from({ length: 20 }, (_, seed) => start(seed).state.chooser),
		);
		expect(choosers).toEqual(new Set([T1, GENG]));
	});

	it("goes to the loser of the previous game", () => {
		let state = start().state;
		const first = state.chooser as string;
		state = ok(
			run(state, "side.choose", { team: first, choice: "blue" }),
		).state;
		state = ok(
			run(state, "side.choose", { team: rival(first), choice: "first" }),
		).state;
		const after = ok(finishGame(state, first)).state;
		expect(after.phase).toBe("side");
		expect(after.chooser).toBe(rival(first));
		expect(after.choices).toEqual([]);
		const chosen = ok(
			run(after, "side.choose", { team: rival(first), choice: "last" }),
		);
		expect(chosen.facts[0]).toMatchObject({ game: 2, by: "loss" });
	});
});

describe("split choice (issue #305)", () => {
	it("lets the team with priority take one of four, and only that team", () => {
		const { state } = start();
		const first = state.chooser as string;
		expect(viewDraft(state, {})?.turn).toEqual({
			team: first,
			action: "side",
			options: ["blue", "red", "first", "last"],
		});
		expect(
			run(state, "side.choose", { team: rival(first), choice: "blue" }),
		).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
	});

	it("records the kind and passes the other kind to the rival", () => {
		const { state } = start();
		const first = state.chooser as string;
		const chosen = ok(
			run(state, "side.choose", { team: first, choice: "last" }),
		);
		expect(chosen.facts).toEqual([
			{
				type: "side.chosen",
				game: 1,
				team: first,
				kind: "order",
				choice: "last",
				by: "draw",
			},
		]);
		expect(chosen.state.phase).toBe("side");
		expect(chosen.state.chooser).toBe(rival(first));
		expect(viewDraft(chosen.state, {})).toMatchObject({
			turn: { team: rival(first), action: "side", options: ["blue", "red"] },
			choices: [{ team: first, choice: "last" }],
			first: null,
		});
		expect(
			run(chosen.state, "side.choose", { team: rival(first), choice: "first" }),
		).toEqual({
			ok: false,
			error: { code: "wrong-action", params: { expected: "side" } },
		});
	});

	it("keeps map side and draft order independent", () => {
		let state = start().state;
		const first = state.chooser as string;
		state = ok(
			run(state, "side.choose", { team: first, choice: "blue" }),
		).state;
		const started = ok(
			run(state, "side.choose", { team: rival(first), choice: "first" }),
		);
		expect(started.facts).toEqual([
			{
				type: "side.chosen",
				game: 1,
				team: rival(first),
				kind: "order",
				choice: "first",
				by: "rest",
			},
			{
				type: "game.started",
				game: 1,
				blue: first,
				red: rival(first),
				first: rival(first),
			},
		]);
		const draft = started.state.draft;
		if (!draft) throw new Error("no draft");
		// Red has first pick: it opens the bans and takes pick 1.
		expect(turn(draft)).toEqual({
			team: rival(first),
			side: "red",
			action: "ban",
		});
		const view = draftView.parse(viewDraft(started.state, {}));
		expect(view.first).toBe("red");
		expect(view.choices).toEqual([
			{ team: first, choice: "blue" },
			{ team: rival(first), choice: "first" },
		]);
		let current = started.state;
		for (const step of DRAFT_ORDER.slice(0, 7)) {
			const next = turn(current.draft as NonNullable<typeof current.draft>);
			expect(next?.side).toBe(step.order === "first" ? "red" : "blue");
			current =
				step.action === "ban"
					? ok(run(current, "draft.ban", { team: next?.team, champion: null }))
							.state
					: ok(
							run(current, "draft.pick", {
								team: next?.team,
								champion: `c${current.draft?.step}`,
							}),
						).state;
		}
		// The last pick still belongs to blue: the 10th pick closes the draft.
		expect(current.draft?.picks.red).toEqual(["c6"]);
	});
});

describe("AI side choice (issue #305)", () => {
	const send = (s: Session<SeriesState>, kind: string, payload: object) =>
		draftDispatcher.handle(s, {
			v: CONTRACT_VERSION,
			kind,
			sessionId: 1,
			expectedPosition: s.position,
			payload,
		});

	it("explains each choice and takes only what is left", () => {
		let s = openSession<SeriesState>(
			1,
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		s = send(s, "series.start", {
			teams: ["forge", "shoal"],
			format: "bo1",
			fearless: "off",
			timer: false,
			pool: fictionalContent.champions.map((c) => c.id),
			seed: 11,
			ai: [{ personality: "counterpick" }, { personality: "flex" }],
		}).session;
		const first = send(s, "draft.ai", {});
		const second = send(first.session, "draft.ai", {});
		if (!first.response.ok || !second.response.ok) throw new Error("rejected");
		expect(first.response.facts.map((f) => f.type)).toEqual([
			"ai.sideDecided",
			"side.chosen",
		]);
		expect(second.response.facts.map((f) => f.type)).toEqual([
			"ai.sideDecided",
			"side.chosen",
			"game.started",
		]);
		const [decided, chosen] = first.response.facts;
		expect(decided).toMatchObject({
			game: 1,
			team: chosen?.team,
			choice: chosen?.choice,
		});
		const kinds = [first, second].map((r) =>
			r.response.ok ? r.response.facts[1]?.kind : null,
		);
		expect(new Set(kinds)).toEqual(new Set(["side", "order"]));
	});
});
