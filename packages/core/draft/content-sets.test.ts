import {
	CONTRACT_VERSION,
	type SeriesOptions,
	seriesOptions,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { loadRealContent } from "../content/real";
import { fictionalMatchContent } from "../match/fixtures/content";
import { type Fact, openSession, type Session } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";
import type { SeriesState } from "./series";

const real = () => {
	const { draft, match } = loadRealContent();
	return { content: draft, match };
};

const withSets = () =>
	openSession<SeriesState>(
		1,
		draftStateWith(fictionalContent, fictionalMatchContent, { real }),
	);

const send = (s: Session<SeriesState>, kind: string, payload: object) =>
	draftDispatcher.handle(s, {
		v: CONTRACT_VERSION,
		kind,
		sessionId: 1,
		expectedPosition: s.position,
		payload,
	});

const accepted = (result: ReturnType<typeof send>) => {
	if (!result.response.ok) throw new Error(JSON.stringify(result.response));
	return { session: result.session, facts: result.response.facts };
};

const options = (s: Session<SeriesState>, params: object = {}) =>
	draftDispatcher.query(s, {
		v: CONTRACT_VERSION,
		kind: "series.options",
		sessionId: 1,
		params,
	});

const view = (s: Session<SeriesState>, params: object = {}): SeriesOptions => {
	const result = options(s, params);
	if (!result.ok) throw new Error(JSON.stringify(result));
	return seriesOptions.parse(result.view);
};

const realStart = () => {
	const { draft, match } = loadRealContent();
	const [a, b] = match.teams;
	return {
		teams: [a?.id, b?.id],
		seeds: [a?.seed, b?.seed],
		format: "bo3",
		fearless: "hard",
		timer: false,
		pool: draft.champions.map((c) => c.id),
		seed: 5,
		ai: ["coach", "coach"],
		content: "real",
	};
};

describe("content sets (plan 11, #251)", () => {
	it("offers the session's fictional content when no set is named", () => {
		expect(view(withSets()).teams.map((t) => t.id)).toEqual(
			fictionalMatchContent.teams.map((t) => t.id),
		);
	});

	it("A2: offers the real teams with their league when asked for them", () => {
		const teams = view(withSets(), { content: "real" }).teams;
		expect(teams).toHaveLength(60);
		expect(new Set(teams.map((t) => t.league))).toEqual(
			new Set(["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"]),
		);
	});

	it("gives one player per role, the starters, with the attributes that are estimated", () => {
		const { draft } = loadRealContent();
		for (const team of view(withSets(), { content: "real" }).teams) {
			expect(team.players.map((p) => p.role).sort()).toEqual(
				["bot", "jungle", "mid", "support", "top"].sort(),
			);
			for (const player of team.players) {
				const source = draft.players.find((p) => p.id === player.id);
				expect(player.estimated ?? []).toEqual(source?.estimated ?? []);
			}
		}
	});

	it("rejects a set the session was not opened with", () => {
		const bare = openSession<SeriesState>(
			1,
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		expect(options(bare, { content: "real" })).toMatchObject({
			ok: false,
			error: { code: "invalid-command", params: { path: "content" } },
		});
		const realStarted = send(bare, "series.start", realStart());
		expect(realStarted.response).toMatchObject({
			ok: false,
			error: { code: "invalid-command", params: { path: "content" } },
		});
	});

	it("plays game 1 of a series started with the real content", () => {
		const started = accepted(send(withSets(), "series.start", realStart()));
		expect(started.facts[0]).toMatchObject({
			type: "series.started",
			content: "real",
		});
		expect(view(started.session).teams).toHaveLength(60);

		let s = started.session;
		const facts: Fact[] = [...started.facts];
		if (s.state.phase === "side") {
			const chooser = s.state.chooser ?? "";
			const next = accepted(
				send(s, "side.choose", { team: chooser, side: "blue" }),
			);
			s = next.session;
			facts.push(...next.facts);
		}
		while (s.state.phase === "draft") {
			const next = accepted(send(s, "draft.ai", {}));
			s = next.session;
			facts.push(...next.facts);
		}
		const played = accepted(send(s, "match.play", {}));
		const ended = played.facts.find((f) => f.type === "game.finished");
		expect(ended).toMatchObject({ game: 1 });
		const pool = new Set(realStart().pool);
		for (const fact of facts.filter((f) => f.type === "draft.picked")) {
			expect(pool.has(fact.champion as string)).toBe(true);
		}
	});

	it("keeps the fictional facts unchanged when no set is named", () => {
		const { content: _, ...fictional } = {
			...realStart(),
			teams: ["forge", "shoal"],
			seeds: [1, 2],
			pool: fictionalContent.champions.map((c) => c.id),
		};
		const started = accepted(send(withSets(), "series.start", fictional));
		expect(started.facts[0]).not.toHaveProperty("content");
		expect(started.session.state.content).toBe(fictionalContent);
	});
});
