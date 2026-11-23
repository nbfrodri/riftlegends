import { CONTRACT_VERSION, PERSONALITIES } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { type Fact, openSession, type Session } from "../server/dispatcher";
import { sideChoices } from "../test/take-sides";
import { draftDispatcher, draftStateWith } from "./index";
import type { SeriesState } from "./series";

const POOL = fictionalContent.champions.map((c) => c.id);
type Ai = { personality: string; coachRating?: number; difficulty?: string };

const session = () =>
	openSession<SeriesState>(
		1,
		draftStateWith(fictionalContent, fictionalMatchContent),
	);

const send = (s: Session<SeriesState>, kind: string, payload: object) =>
	draftDispatcher.handle(s, {
		v: CONTRACT_VERSION,
		kind,
		sessionId: 1,
		expectedPosition: s.position,
		payload,
	});

const started = (
	ai: [Ai | "coach" | null, Ai | "coach" | null],
	extra: object = {},
): Session<SeriesState> => {
	const result = send(session(), "series.start", {
		teams: ["forge", "shoal"],
		format: "bo1",
		fearless: "hard",
		timer: false,
		pool: POOL,
		seed: 11,
		ai,
		...extra,
	});
	if (!result.response.ok) throw new Error(JSON.stringify(result.response));
	return result.session;
};

/** Lets the AI play every turn and simulates each game. */
const playOut = (start: Session<SeriesState>) => {
	let s = start;
	const facts: Fact[] = [];
	for (let guard = 0; guard < 400 && s.state.phase !== "over"; guard++) {
		const kind = s.state.phase === "result" ? "match.play" : "draft.ai";
		const result = send(s, kind, {});
		if (!result.response.ok) {
			throw new Error(
				`${kind} rejected: ${JSON.stringify(result.response.error)}`,
			);
		}
		facts.push(...result.response.facts);
		s = result.session;
	}
	return { session: s, facts };
};

it("C2: finishes every hard fearless Bo5 between packaged coaches with legal picks", () => {
	const teams = fictionalMatchContent.teams;
	let reachedDecider = false;
	fc.assert(
		fc.property(
			fc.integer({ min: 0, max: 0xffffffff }),
			fc.integer({ min: 0, max: teams.length - 1 }),
			fc.integer({ min: 1, max: teams.length - 1 }),
			(root, first, offset) => {
				const second = (first + offset) % teams.length;
				const a = teams[first];
				const b = teams[second];
				if (!a || !b) throw new Error("Missing team");
				const { facts, session: end } = playOut(
					started(["coach", "coach"], {
						teams: [a.id, b.id],
						format: "bo5",
						seed: deriveSeed(root, SCOPES.draft, first, second),
					}),
				);
				expect(end.state.phase).toBe("over");
				expect(end.state.wins).toContain(3);
				expect(facts.at(-1)?.type).toBe("series.finished");
				const played = facts.filter((fact) => fact.type === "game.finished");
				const picks = facts.filter((fact) => fact.type === "draft.picked");
				expect(picks).toHaveLength(10 * played.length);
				expect(new Set(picks.map((fact) => fact.champion)).size).toBe(
					picks.length,
				);
				for (const { game } of played) {
					const bans = facts
						.filter(
							(fact) => fact.type === "draft.banned" && fact.game === game,
						)
						.map((fact) => fact.champion);
					const current = picks.filter((fact) => fact.game === game);
					expect(current).toHaveLength(10);
					if (game === 5) {
						expect(new Set(bans).size).toBe(10);
						for (const ban of bans) expect(POOL).toContain(ban);
						reachedDecider = true;
					}
					for (const { champion } of current) {
						expect(POOL).toContain(champion);
						expect(bans).not.toContain(champion);
					}
				}
			},
		),
		{ seed: 231, numRuns: 40 },
	);
	expect(reachedDecider).toBe(true);
}, 60_000);

describe("draft.ai (C1)", () => {
	it("plays legal series to the end, whatever the settings", () => {
		const ai = fc.record(
			{
				personality: fc.constantFrom(...PERSONALITIES),
				coachRating: fc.integer({ min: 0, max: 50 }),
			},
			{ requiredKeys: ["personality"] },
		);
		const series = fc.oneof(
			fc.record({
				format: fc.constant("bo3"),
				fearless: fc.constantFrom("hard", "soft"),
			}),
			fc.record({ format: fc.constant("bo5"), fearless: fc.constant("off") }),
		);
		fc.assert(
			fc.property(ai, ai, series, fc.nat(2 ** 31), (a, b, rules, seed) => {
				const { session: end, facts } = playOut(
					started([a, b], { ...rules, seed }),
				);
				expect(end.state.phase).toBe("over");
				expect(facts.at(-1)?.type).toBe("series.finished");
			}),
			{ numRuns: 15 },
		);
	});

	it("explains each ban and pick just before it", () => {
		const { facts } = playOut(
			started([{ personality: "meta" }, { personality: "comfort" }]),
		);
		const decided = facts.filter((f) => f.type === "ai.decided");
		expect(decided).toHaveLength(20);
		for (const fact of decided) {
			const next = facts[facts.indexOf(fact) + 1];
			expect(next?.type).toBe(
				fact.action === "ban" ? "draft.banned" : "draft.picked",
			);
			expect(next?.champion).toBe(fact.champion);
			const components = fact.components as { points: number }[];
			expect(components.reduce((sum, c) => sum + c.points, 0)).toBe(fact.total);
		}
	});

	it("assigns every role and chooses a side", () => {
		const { facts } = playOut(
			started([{ personality: "flex" }, { personality: "early" }]),
		);
		expect(facts.filter((f) => f.type === "draft.rolesAssigned")).toHaveLength(
			2,
		);
		expect(facts.filter((f) => f.type === "side.chosen")).toMatchObject([
			{ by: "draw" },
			{ by: "rest" },
		]);
		expect(facts.filter((f) => f.type === "ai.sideDecided")).toHaveLength(2);
	});

	it("is the same for the same seed (C3)", () => {
		const run = () =>
			playOut(
				started([
					{ personality: "pocket", difficulty: "easy" },
					{ personality: "counterpick" },
				]),
			).facts;
		expect(run()).toEqual(run());
	});

	it("does not play for a human team", () => {
		const s = started([null, { personality: "meta" }]);
		expect(send(s, "draft.ai", {}).response).toEqual({
			ok: false,
			error: { code: "wrong-action", params: { expected: "human" } },
		});
	});

	it("answers a human pick", () => {
		let s = started([null, { personality: "meta" }]);
		for (const payload of sideChoices(s.state, "forge"))
			s = send(s, "side.choose", payload).session;
		s = send(s, "draft.ban", { team: "forge", champion: null }).session;
		const result = send(s, "draft.ai", {});
		expect(
			result.response.ok && result.response.facts.map((f) => f.type),
		).toEqual(["ai.decided", "draft.banned"]);
	});
});
