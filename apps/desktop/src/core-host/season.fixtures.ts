import { expect } from "vitest";
import { createCoreHost, type HostResult } from "./host";

export const teams = ["forge", "shoal", "breakwater", "sunspoke"].map(
	(id, index) => ({
		id,
		competition: "league",
		region: "region",
		rank: index + 1,
	}),
);
export const window = {
	startWeek: 0,
	weeks: 2,
	matchDays: 7,
	maxSeriesPerDay: 4,
};
export const season = {
	year: 2026,
	seed: 42,
	teams,
	competitions: [
		{
			id: "league",
			kind: "league",
			verified: false,
			tiebreakerBestOf: 3,
			fearless: "hard",
			tiebreak: ["seriesWins", "gameDiff", "headToHead"],
			stages: [
				{
					id: "split",
					window,
					entrants: { kind: "fixed", teams: teams.map(({ id }) => id) },
					play: {
						type: "swiss",
						size: 4,
						wins: 1,
						losses: 1,
						bestOf: 1,
						decisiveBestOf: 1,
						round1: "pots",
						avoid: [],
					},
				},
			],
		},
	],
};

export function client() {
	const host = createCoreHost();
	const opened = host.receive({ id: 1, op: "open" }).result;
	if (!("sessionId" in opened)) throw new Error("Session did not open");
	let position = 0;
	const request = (op: "send" | "query", kind: string, fields: object) =>
		host.receive({
			id: 2,
			op,
			body: JSON.stringify({
				v: 1,
				sessionId: opened.sessionId,
				kind,
				...fields,
			}),
		}).result;
	return {
		send(kind: string, payload: object, expectedPosition = position) {
			const result = request("send", kind, { payload, expectedPosition });
			if ("position" in result) position = result.position;
			return result;
		},
		query: (kind: string, params: object) => request("query", kind, { params }),
		position: () => position,
	};
}

export function accepted(result: HostResult) {
	expect(result, JSON.stringify(result.ok ? null : result.error)).toMatchObject(
		{ ok: true },
	);
	if (!("facts" in result)) throw new Error("Expected facts");
	return result;
}
