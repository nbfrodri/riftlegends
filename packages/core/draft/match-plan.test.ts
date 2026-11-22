import {
	type AiOfTeam,
	CONTRACT_VERSION,
	type MatchPlan,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { openSession } from "../server/dispatcher";
import { draftDispatcher } from "./index";
import { drafted, loaded, run } from "./match-test-fixture";
import type { SeriesState } from "./series";

const balanced = {
	tempo: "balanced",
	objectives: "balanced",
	risk: "balanced",
} as const;

const plan = (state: SeriesState) =>
	draftDispatcher.query(openSession(1, state), {
		v: CONTRACT_VERSION,
		kind: "match.plan",
		sessionId: 1,
		params: {},
	});

describe("match.plan", () => {
	it.each([
		{
			power: "late",
			archetype: "splitpush",
			tempo: "slow",
			objectives: "baron",
			risk: "safe",
		},
		{
			power: "early",
			archetype: "engage",
			tempo: "fast",
			objectives: "dragon",
			risk: "risky",
		},
	] as const)(
		"recommends $tempo play for a $power $archetype draft",
		({ power, archetype, tempo, objectives, risk }) => {
			const state = drafted(loaded(), ["coach", null]);
			const picks = state.draft?.picks.red ?? [];
			const withDraft = {
				...state,
				content: {
					...fictionalContent,
					champions: fictionalContent.champions.map((champion) => ({
						...champion,
						power: picks.includes(champion.id) ? power : ("mid" as const),
						archetypes: picks.includes(champion.id) ? [archetype] : [],
					})),
				},
			};
			const suggestion = plan(withDraft);
			expect(suggestion).toEqual(plan(withDraft));
			expect(suggestion).toMatchObject({
				ok: true,
				view: {
					game: 1,
					team: "shoal",
					strategy: { tempo, objectives, risk },
					causes: expect.arrayContaining([
						{
							key: `tempo.own.${power}`,
							points: power === "early" ? 100000 : -100000,
						},
						...(power === "early"
							? [{ key: "objectives.mid", points: 50000 }]
							: []),
					]),
				},
			});
		},
	);

	it("only gives reasons that support each lever's chosen direction, strongest first", () => {
		const state = drafted(loaded(), ["coach", null]);
		const own = state.draft?.picks.red ?? [];
		const rival = state.draft?.picks.blue ?? [];
		const mixed = (picks: readonly string[], powers: readonly string[]) =>
			Object.fromEntries(picks.map((id, i) => [id, powers[i % powers.length]]));
		const powers = {
			...mixed(own, ["early", "early", "late", "late", "mid"]),
			...mixed(rival, ["mid"]),
		};
		const result = plan({
			...state,
			content: {
				...fictionalContent,
				champions: fictionalContent.champions.map((champion) => ({
					...champion,
					power: (powers[champion.id] ?? "mid") as "early" | "mid" | "late",
					archetypes: own.includes(champion.id) ? ["splitpush"] : [],
				})),
			},
		});
		if (!result.ok) throw new Error("expected a plan");
		const view = { view: result.view as MatchPlan };
		for (const lever of ["tempo", "objectives", "risk"] as const) {
			const mine = view.view.causes.filter((c) =>
				c.key.startsWith(`${lever}.`),
			);
			const sign = {
				fast: 1,
				dragon: 1,
				risky: 1,
				slow: -1,
				baron: -1,
				safe: -1,
				balanced: 0,
			}[view.view.strategy[lever]];
			for (const cause of mine) expect(cause.points * sign).toBeGreaterThan(0);
			const weights = mine.map((c) => c.points * sign);
			expect(weights).toEqual([...weights].sort((a, b) => b - a));
		}
		expect(view.view.causes.length).toBeGreaterThan(0);
	});

	it("recommends a balanced plan for identical mid-game poke drafts", () => {
		const state = drafted(loaded(), [null, "coach"]);
		expect(
			plan({
				...state,
				content: {
					...fictionalContent,
					champions: fictionalContent.champions.map((champion) => ({
						...champion,
						power: "mid",
						archetypes: ["poke"],
					})),
				},
			}),
		).toEqual({
			ok: true,
			view: { game: 1, team: "forge", strategy: balanced, causes: [] },
		});
	});

	it("requires a finished draft", () => {
		expect(plan(loaded())).toMatchObject({
			ok: false,
			error: { code: "wrong-action" },
		});
	});

	it("uses the rival's timing with the same human picks and rejects missing champion data", () => {
		const state = drafted(loaded(), [null, "coach"]);
		const rival = state.draft?.picks.red ?? [];
		const champions = fictionalContent.champions.map((champion) => ({
			...champion,
			power: "mid" as const,
			archetypes: [],
		}));
		for (const [power, tempo] of [
			["early", "slow"],
			["late", "fast"],
		] as const) {
			expect(
				plan({
					...state,
					content: {
						...fictionalContent,
						champions: champions.map((champion) =>
							rival.includes(champion.id) ? { ...champion, power } : champion,
						),
					},
				}),
			).toMatchObject({ ok: true, view: { strategy: { tempo } } });
		}
		expect(
			plan({
				...state,
				content: {
					...fictionalContent,
					champions: champions.filter((champion) => champion.id !== rival[0]),
				},
			}),
		).toEqual({
			ok: false,
			error: { code: "invalid-command", params: { path: "content" } },
		});
	});

	it.each([
		{ ai: undefined },
		{ ai: [null, null] },
		{ ai: ["coach", "coach"] },
	] satisfies { ai: [AiOfTeam, AiOfTeam] | undefined }[])(
		"requires exactly one human team (%j)",
		({ ai }) => {
			const state = drafted(loaded(), ai);
			const error = {
				ok: false,
				error: { code: "invalid-command", params: { path: "strategy" } },
			};
			expect(
				run(state, "match.play", { strategy: { ...balanced, tempo: "fast" } }),
			).toMatchObject(error);
			expect(plan(state)).toEqual(error);
			expect(run(state, "match.play", {}).ok).toBe(true);
		},
	);
});
