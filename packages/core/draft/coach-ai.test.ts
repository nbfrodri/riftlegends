import { CONTRACT_VERSION, type MatchContent } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { type Fact, openSession, type Session } from "../server/dispatcher";
import { sideChoices } from "../test/take-sides";
import { draftDispatcher, draftStateWith } from "./index";
import type { SeriesState } from "./series";

const POOL = fictionalContent.champions.map((c) => c.id);

/** Match content with a different coach for `shoal`. */
const withCoach = (
	coach: MatchContent["teams"][number]["coach"],
): MatchContent => ({
	...fictionalMatchContent,
	teams: fictionalMatchContent.teams.map((team) =>
		team.id === "shoal" ? { ...team, coach } : team,
	),
});

const send = (s: Session<SeriesState>, kind: string, payload: object) => {
	const result = draftDispatcher.handle(s, {
		v: CONTRACT_VERSION,
		kind,
		sessionId: 1,
		expectedPosition: s.position,
		payload,
	});
	if (!result.response.ok) throw new Error(JSON.stringify(result.response));
	return { session: result.session, facts: result.response.facts };
};

/** What the `shoal` AI decides in its first ban. */
const firstDecision = (match: MatchContent, ai: unknown): Fact => {
	let s = openSession<SeriesState>(1, draftStateWith(fictionalContent, match));
	s = send(s, "series.start", {
		teams: ["forge", "shoal"],
		format: "bo1",
		fearless: "off",
		timer: false,
		pool: POOL,
		seed: 7,
		ai: [null, ai],
	}).session;
	for (const payload of sideChoices(s.state, "forge"))
		s = send(s, "side.choose", payload).session;
	s = send(s, "draft.ban", { team: "forge", champion: null }).session;
	const decided = send(s, "draft.ai", {}).facts.find(
		(f) => f.type === "ai.decided",
	);
	if (!decided) throw new Error("the AI did not decide");
	return decided;
};

const COACH = { name: "Iko Rhane", personality: "pocket", rating: 45 } as const;

describe('"coach" in series.start (Q2)', () => {
	it("takes personality and rating from the team's coach", () => {
		const fromCoach = firstDecision(withCoach(COACH), "coach");
		const explicit = firstDecision(fictionalMatchContent, {
			personality: COACH.personality,
			coachRating: COACH.rating,
		});
		expect(fromCoach).toEqual(explicit);
	});

	it("uses a different AI for a different coach", () => {
		const other = { name: "Mara", personality: "meta", rating: 5 } as const;
		expect(firstDecision(withCoach(COACH), "coach")).not.toEqual(
			firstDecision(withCoach(other), "coach"),
		);
	});

	it("falls back to balanced and normal when the team has no match content", () => {
		const withoutRival = {
			...fictionalMatchContent,
			teams: fictionalMatchContent.teams.filter((team) => team.id !== "shoal"),
		};
		const fallback = firstDecision(withoutRival, "coach");
		const explicit = firstDecision(withoutRival, {
			personality: "balanced",
			difficulty: "normal",
		});
		expect(fallback).toEqual(explicit);
	});

	it("keeps explicit settings working", () => {
		const fact = firstDecision(withCoach(COACH), {
			personality: "meta",
			difficulty: "hard",
		});
		expect(fact.type).toBe("ai.decided");
	});
});
