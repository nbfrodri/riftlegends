import { describe, expect, it } from "vitest";
import en from "../locales/en.json" with { type: "json" };
import es from "../locales/es.json" with { type: "json" };

describe("catalogs", () => {
	it("have the same key set in ES and EN", () => {
		expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
	});

	it("have no empty values", () => {
		for (const catalog of [es, en]) {
			for (const [key, value] of Object.entries(catalog)) {
				expect(value.trim(), key).not.toBe("");
			}
		}
	});

	it("name the positions with competitive jargon in both languages", () => {
		const roles = ["top", "jungle", "mid", "bot", "support"] as const;
		const labels = (catalog: Record<string, string>) =>
			roles.map((role) => catalog[`market.role.${role}`]);
		expect(labels(es)).toEqual(["Top", "Jungla", "Mid", "ADC", "Support"]);
		expect(labels(en)).toEqual(["Top", "Jungle", "Mid", "ADC", "Support"]);
	});
});
