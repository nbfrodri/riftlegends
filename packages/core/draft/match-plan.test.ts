import { type AiOfTeam, CONTRACT_VERSION } from "@rift-legends/contracts";
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
						{ key: "objectives.mid", points: 50000 },
					]),
				},
			});
		},
	);

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
