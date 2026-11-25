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

	it("carries a starter's birth date to the player card", () => {
		const content = {
			...fictionalContent,
			players: fictionalContent.players.map((player) =>
				player.id === "forge-mid"
					? { ...player, birthDate: "2001-03-03" }
					: player,
			),
		};
		const result = options(draftStateWith(content, fictionalMatchContent));
		if (!result.ok) throw new Error(JSON.stringify(result));
		const players = seriesOptions
			.parse(result.view)
			.teams.flatMap((team) => team.players);
		expect(players.find((p) => p.id === "forge-mid")?.birthDate).toBe(
			"2001-03-03",
		);
		expect(players.find((p) => p.id === "forge-top")).not.toHaveProperty(
			"birthDate",
		);
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
			nationality: "GB",
			attributes: { experience: 98, composure: 95, lanes: 92 },
		});
	});

	it("gives each starter's champion pool: mains, secondary and weak with mastery", () => {
		const result = options(
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		if (!result.ok) throw new Error(JSON.stringify(result));
		const view = seriesOptions.parse(result.view);
		for (const player of view.teams.flatMap((t) => t.players)) {
			const source = fictionalContent.players.find((p) => p.id === player.id);
			const mastery = fictionalMatchContent.players.find(
				(p) => p.id === player.id,
			)?.mastery;
			const expected = [
				...(source?.mains ?? []).map((champion) => ({
					champion,
					kind: "main",
				})),
				...(source?.secondary ?? []).map((champion) => ({
					champion,
					kind: "secondary",
				})),
				...(source?.weak ?? []).map((champion) => ({ champion, kind: "weak" })),
			].flatMap((entry) => {
				const row = mastery?.find((m) => m.champion === entry.champion);
				return row ? [{ ...entry, mastery: row.value }] : [];
			});
			expect(player.pool).toEqual(expected);
		}
		expect(
			view.teams.flatMap((t) => t.players).some((p) => p.pool.length > 0),
		).toBe(true);
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
