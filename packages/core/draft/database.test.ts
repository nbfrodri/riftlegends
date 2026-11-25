import {
	CONTRACT_VERSION,
	type ContentDatabase,
	contentDatabase,
	draftQueries,
	parseQuery,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { loadRealContent } from "../content/real";
import { fictionalMatchContent } from "../match/fixtures/content";
import { openSession } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";
import { initialSeries, type SeriesState } from "./series";

const real = () => {
	const { draft, match } = loadRealContent();
	return { content: draft, match };
};

const ask = (state: SeriesState, params: object = {}) =>
	draftDispatcher.query(openSession(1, state), {
		v: CONTRACT_VERSION,
		kind: "content.database",
		sessionId: 1,
		params,
	});

const database = (state: SeriesState, params: object = {}): ContentDatabase => {
	const result = ask(state, params);
	if (!result.ok) throw new Error(JSON.stringify(result));
	return contentDatabase.parse(result.view);
};

const withReal = () =>
	draftStateWith(fictionalContent, fictionalMatchContent, { real });

describe("content.database (#443)", () => {
	it("is a query of the draft catalog that may name a content set", () => {
		for (const params of [{}, { content: "real" }])
			expect(
				parseQuery(draftQueries, {
					v: CONTRACT_VERSION,
					kind: "content.database",
					sessionId: 1,
					params,
				}).ok,
			).toBe(true);
	});

	it("lists every real player, subs included, with team, level and attributes", () => {
		const { draft } = loadRealContent();
		const { players } = database(withReal(), { content: "real" });
		expect(players.map((p) => p.id)).toEqual(draft.players.map((p) => p.id));
		expect(players.some((p) => p.sub)).toBe(true);
		for (const player of players) {
			const source = draft.players.find((p) => p.id === player.id);
			expect(player).toMatchObject({
				team: source?.team,
				role: source?.role,
				handle: source?.handle,
				level: source?.level,
				sub: source?.sub ?? false,
			});
			expect(player.nationality).toBe(source?.nationality);
			expect(player.estimated ?? []).toEqual(source?.estimated ?? []);
			expect(Object.keys(player.attributes)).toHaveLength(20);
		}
	});

	it("lists every real team with short name, league, seed and coach", () => {
		const { match } = loadRealContent();
		const { teams } = database(withReal(), { content: "real" });
		expect(teams).toEqual(
			match.teams.map(({ id, name, short, league, seed, coach }) => ({
				id,
				name,
				...(short && { short }),
				...(league && { league }),
				seed,
				coach,
			})),
		);
	});

	it("gives each player's champion pool with mastery", () => {
		const { players } = database(withReal());
		const first = players[0];
		const source = fictionalContent.players.find((p) => p.id === first?.id);
		expect(first?.pool.map((entry) => entry.champion)).toEqual(
			[
				...(source?.mains ?? []),
				...(source?.secondary ?? []),
				...(source?.weak ?? []),
			].filter((champion) => first?.pool.some((e) => e.champion === champion)),
		);
		expect(first?.pool.length).toBeGreaterThan(0);
	});

	it("is empty in a session without content and rejects an unknown set", () => {
		expect(database(initialSeries)).toEqual({ teams: [], players: [] });
		expect(
			ask(draftStateWith(fictionalContent, fictionalMatchContent), {
				content: "real",
			}),
		).toMatchObject({
			ok: false,
			error: { code: "invalid-command", params: { path: "content" } },
		});
	});
});
