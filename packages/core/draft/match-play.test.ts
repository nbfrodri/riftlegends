import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { abs } from "../math";
import { takeSides } from "../test/take-sides";
import {
	type Accepted,
	drafted,
	draftWith,
	loaded,
	ok,
	run,
} from "./match-test-fixture";

const POOL = fictionalContent.champions.map((c) => c.id);

describe("match.play", () => {
	it("plays the game and finishes it with its winner", () => {
		const outcome = ok(run(drafted(), "match.play", {}));
		const types = outcome.facts.map((f) => f.type);
		expect(types[0]).toBe("match.started");
		expect(types.at(-2)).toBe("match.ended");
		expect(types.at(-1)).toBe("game.finished");
		const ended = outcome.facts.at(-2) as unknown as { winner: string };
		expect(outcome.facts.at(-1)).toMatchObject({
			game: 1,
			winner: ended.winner,
		});
		const index = ended.winner === "forge" ? 0 : 1;
		expect(outcome.state.wins[index]).toBe(1);
		expect(outcome.state.phase).toBe("side");
	});

	it("carries the series into the next game: momentum and what the rival did best", () => {
		const first = ok(run(drafted(), "match.play", {}));
		const causes = (facts: readonly { type: string }[]) =>
			new Set(
				facts
					.filter((f) => f.type === "match.event")
					.flatMap(
						(f) => (f as unknown as { causes: { key: string }[] }).causes,
					)
					.map((c) => c.key),
			);
		expect(causes(first.facts).has("momentum")).toBe(false);
		expect(causes(first.facts).has("side")).toBe(true);
		const [outcome] = first.state.outcomes;
		expect(outcome?.winner).toBe(
			(first.facts.at(-1) as unknown as { winner: string }).winner,
		);
		expect(["lane", "jungle", "fight", "objective", "siege"]).toContain(
			outcome?.edge,
		);

		let next = first.state;
		next = draftWith(takeSides(next, "shoal"));
		const second = ok(run(next, "match.play", {}));
		expect(causes(second.facts).has("momentum")).toBe(true);
	});

	it("keeps the same map sides and match facts when only first pick changes", () => {
		const state = drafted();
		if (!state.draft) throw new Error("missing draft");
		const blueFirst = ok(run(state, "match.play", {}));
		const redFirst = ok(
			run(
				{
					...state,
					draft: { ...state.draft, first: "red" },
				},
				"match.play",
				{},
			),
		);
		expect(redFirst.facts[0]).toMatchObject({
			type: "match.started",
			blue: "forge",
			red: "shoal",
		});
		expect(redFirst.facts).toEqual(blueFirst.facts);
	});

	it("is deterministic for the series seed", () => {
		expect(run(drafted(), "match.play", {})).toEqual(
			run(drafted(), "match.play", {}),
		);
	});

	it("only plays once both drafts are done", () => {
		const started = ok(
			run(loaded(), "series.start", {
				teams: ["forge", "shoal"],
				format: "bo1",
				fearless: "off",
				timer: false,
				pool: POOL,
				seed: 1,
			}),
		).state;
		expect(run(started, "match.play", {})).toMatchObject({
			ok: false,
			error: { code: "wrong-action" },
		});
	});

	it("needs the match content loaded with the session", () => {
		const state = { ...drafted(), match: null };
		expect(run(state, "match.play", {})).toMatchObject({
			ok: false,
			error: { code: "invalid-command", params: { path: "match" } },
		});
	});
});

const balanced = {
	tempo: "balanced",
	objectives: "balanced",
	risk: "balanced",
} as const;
const fast = { ...balanced, tempo: "fast" } as const;
const balancedMatch = {
	...fictionalMatchContent,
	teams: fictionalMatchContent.teams.map((team) => ({
		...team,
		strategy: balanced,
	})),
};
const profile = (result: Accepted) =>
	(
		result.facts[0] as unknown as {
			profiles: Record<"blue" | "red", { phases: { early: number } }>;
		}
	).profiles;
const firstEvent = (result: Accepted) =>
	result.facts.find((f) => f.type === "match.event") as unknown as {
		chance: number;
	};

describe("match.play strategy", () => {
	it("applies fast tempo only to the human team and only for that game", () => {
		const state = drafted(loaded(balancedMatch), ["coach", null]);
		const original = ok(run(state, "match.play", {}));
		const played = ok(run(state, "match.play", { strategy: fast }));
		expect(profile(played).red.phases.early).toBeGreaterThan(
			profile(original).red.phases.early,
		);
		expect(profile(played).blue).toEqual(profile(original).blue);
		expect(played).toEqual(run(state, "match.play", { strategy: fast }));
		expect(played.state.match).toBe(balancedMatch);
		for (const team of played.state.match?.teams ?? []) {
			expect(team.strategy).toEqual(balanced);
		}
		const next = draftWith(takeSides(played.state, "forge"));
		expect(profile(ok(run(next, "match.play", {})))).toEqual(profile(original));
	});

	it("pulls the same opening contest toward even odds with risky play", () => {
		const state = drafted(loaded(balancedMatch), [null, "coach"]);
		const normal = firstEvent(ok(run(state, "match.play", {})));
		const risky = firstEvent(
			ok(
				run(state, "match.play", { strategy: { ...balanced, risk: "risky" } }),
			),
		);
		expect(abs(risky.chance - 5000)).toBeLessThan(abs(normal.chance - 5000));
	});

	it("adds objective priority to the chosen contest", () => {
		const state = drafted(loaded(balancedMatch), [null, "coach"]);
		const dragon = (result: Accepted) =>
			result.facts.find((f) => f.kind === "dragon") as unknown as {
				side: "blue" | "red";
				causes: { key: string; points: number }[];
			};
		expect(
			dragon(ok(run(state, "match.play", {}))).causes.some(
				(c) => c.key === "strategy",
			),
		).toBe(false);
		const event = dragon(
			ok(
				run(state, "match.play", {
					strategy: { ...balanced, objectives: "dragon" },
				}),
			),
		);
		expect(event.causes).toContainEqual({
			key: "strategy",
			points: event.side === "blue" ? 30000 : -30000,
		});
	});
});
