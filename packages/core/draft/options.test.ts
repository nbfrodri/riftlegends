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

	it("lists the teams with name and coach, and the champion pool", () => {
		const result = options(
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		if (!result.ok) throw new Error(JSON.stringify(result));
		const view = seriesOptions.parse(result.view);
		expect(view.teams.map((t) => t.id)).toEqual(["forge", "shoal"]);
		expect(view.teams[0]).toMatchObject({
			name: "Forge",
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

	it("is empty in a session without content", () => {
		const result = options(initialSeries);
		if (!result.ok) throw new Error(JSON.stringify(result));
		expect(result.view).toEqual({ teams: [], pool: [], positions: {} });
	});
});
