import {
	CONTRACT_VERSION,
	draftQueries,
	parseQuery,
	seriesOptions,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { openSession } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";
import { initialSeries, type SeriesState } from "./series";

const options = (state: SeriesState) =>
	draftDispatcher.query(openSession(1, state), {
		v: CONTRACT_VERSION,
		kind: "series.options",
		sessionId: 1,
		params: {},
	});

describe("series.options (plan 09, U1)", () => {
	it("is a query of the draft catalog", () => {
		expect(
			parseQuery(draftQueries, {
				v: CONTRACT_VERSION,
				kind: "series.options",
				sessionId: 1,
				params: {},
			}).ok,
		).toBe(true);
	});

	it("lists the teams with name, seed and coach, and the champion pool", () => {
		const result = options(
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		if (!result.ok) throw new Error(JSON.stringify(result));
		const view = seriesOptions.parse(result.view);
		expect(view.teams.map((t) => t.id)).toEqual(
			fictionalMatchContent.teams.map((t) => t.id),
		);
		expect(view.teams[0]).toMatchObject({
			name: "Forge",
			seed: 1,
			coach: { name: "Marlen Voss", personality: "comfort", rating: 38 },
		});
		expect(view.pool).toEqual(fictionalContent.champions.map((c) => c.id));
	});

	it("gives the roles each champion can play, with their tier", () => {
		const result = options(
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		if (!result.ok) throw new Error(JSON.stringify(result));
		const view = seriesOptions.parse(result.view);
		for (const champion of fictionalContent.champions)
			expect(view.positions[champion.id]).toEqual(champion.positions);
	});

	it("gives each champion's roles and each team's players with their attributes (U3, U5)", () => {
		const result = options(
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		if (!result.ok) throw new Error(JSON.stringify(result));
		const view = seriesOptions.parse(result.view);
		expect(view.champions).toContainEqual({
			id: "rimefoil",
			name: "Rimefoil",
			roles: ["top", "mid"],
		});
		expect(view.champions.map((c) => c.id)).toEqual(view.pool);
		const forge = view.teams[0]?.players ?? [];
		expect(forge.map((p) => p.role)).toEqual([
			"top",
			"jungle",
			"mid",
			"bot",
			"support",
		]);
		expect(forge[2]).toMatchObject({
			id: "forge-mid",
			attributes: { experience: 98, composure: 95, lanes: 92 },
		});
	});

	it("is empty in a session without content", () => {
		const result = options(initialSeries);
		if (!result.ok) throw new Error(JSON.stringify(result));
		expect(result.view).toEqual({
			teams: [],
			pool: [],
			positions: {},
			champions: [],
		});
	});
});
