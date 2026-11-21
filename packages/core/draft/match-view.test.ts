import { CONTRACT_VERSION, matchView } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { type Fact, openSession, type Session } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";
import type { SeriesState } from "./series";

const POOL = fictionalContent.champions.map((c) => c.id);

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

const view = (s: Session<SeriesState>, game: number) =>
	draftDispatcher.query(s, {
		v: CONTRACT_VERSION,
		kind: "match.view",
		sessionId: 1,
		params: { game },
	});

/** Two AI teams play the first game of a Bo3; returns what `match.play` emitted. */
const playFirstGame = () => {
	const ai = { personality: "balanced", difficulty: "normal" };
	let s = openSession<SeriesState>(
		1,
		draftStateWith(fictionalContent, fictionalMatchContent),
	);
	s = send(s, "series.start", {
		teams: ["forge", "shoal"],
		seeds: [1, 2],
		format: "bo3",
		fearless: "off",
		timer: false,
		pool: POOL,
		seed: 3,
		ai: [ai, ai],
	}).session;
	let played: Fact[] = [];
	for (let guard = 0; guard < 100 && s.state.game === 1; guard++) {
		const kind = s.state.phase === "result" ? "match.play" : "draft.ai";
		const step = send(s, kind, {});
		if (kind === "match.play") played = [...step.facts];
		s = step.session;
	}
	return { session: s, played };
};

describe("match.view (Q3)", () => {
	it("returns the match facts of a played game without simulating again", () => {
		const { session, played } = playFirstGame();
		const expected = played
			.filter((f) => f.type.startsWith("match."))
			.map(({ position: _, ...fact }) => fact);
		expect(expected.length).toBeGreaterThan(2);

		const answer = view(session, 1);
		const { view: shown } = answer as { view: { snapshots: unknown[] } };
		expect(answer).toEqual({
			ok: true,
			view: { game: 1, facts: expected, snapshots: shown.snapshots },
		});
		// Q4: the start plus one snapshot per minute, up to the last event's.
		const last = expected.filter((f) => f.type === "match.event").at(-1);
		expect(shown.snapshots).toHaveLength((last?.minute as number) + 1);
		expect(matchView.parse((answer as { view: unknown }).view)).toBeTruthy();
		// Reading twice gives the same facts: nothing is played again.
		expect(view(session, 1)).toEqual(answer);
	});

	it("rejects a game that has not been played", () => {
		const { session } = playFirstGame();
		expect(view(session, 2)).toEqual({
			ok: false,
			error: { code: "game-not-played", params: { game: 2 } },
		});
		expect(view(session, 0)).toMatchObject({
			ok: false,
			error: { code: "game-not-played" },
		});
	});

	it("rejects every game before the series has one played", () => {
		const s = openSession<SeriesState>(
			1,
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		expect(view(s, 1)).toMatchObject({
			ok: false,
			error: { code: "game-not-played" },
		});
	});
});
