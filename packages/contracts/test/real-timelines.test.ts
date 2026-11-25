import { describe, expect, it } from "vitest";
import { realTimelinesSchema } from "../draft/real-timelines";

const band = { taken: 4, more: 2, fewer: 1, moreBp: 5000, fewerBp: 2500 };
const file = {
	provenance: {
		source: "Leaguepedia",
		domain: "lol.fandom.com",
		licence: "CC BY-SA 3.0",
		attribution: "x",
		season: 2026,
	},
	games: { LCK: 3 },
	bands: {
		k19: { baron: band, inhibitor: band, tower: band },
		k20: [
			{ margin: "1", fights: 2, converted: 1, bp: 5000 },
			{ margin: "2", fights: 2, converted: 1, bp: 5000 },
			{ margin: "3+", fights: 2, converted: 2, bp: 10000 },
		],
		k21: {
			lateFights: { fights: 2, closed: 1, bp: 5000 },
			nexus: { games: 2, threeOrMore: 1, bp: 5000 },
		},
		k22: { deaths: 10, p10: 12, p50: 30, p90: 50 },
	},
	levelCurve: {
		top: [10, 20],
		jungle: [10, 20],
		mid: [10, 20],
		bot: [10, 20],
		support: [10, 20],
	},
};

describe("realTimelinesSchema", () => {
	it("accepts aggregates", () => {
		expect(realTimelinesSchema.parse(file)).toEqual(file);
	});
	it("requires the same number of minutes for every role", () => {
		expect(() =>
			realTimelinesSchema.parse({
				...file,
				levelCurve: { ...file.levelCurve, top: [10] },
			}),
		).toThrow();
	});
	it("rejects levels outside 1 to 18 and basis points above 10000", () => {
		expect(() =>
			realTimelinesSchema.parse({
				...file,
				levelCurve: { ...file.levelCurve, top: [10, 200] },
			}),
		).toThrow();
		expect(() =>
			realTimelinesSchema.parse({
				...file,
				bands: { ...file.bands, k22: { ...file.bands.k22, p50: -1 } },
			}),
		).toThrow();
	});
	it("rejects LPL, which has no timelines", () => {
		expect(() =>
			realTimelinesSchema.parse({ ...file, games: { LPL: 3 } }),
		).toThrow();
	});
});
