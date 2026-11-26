import { describe, expect, it } from "vitest";
import { MATCH_CAUSE_KEYS } from "../../core/match/cause-keys";
import en from "../locales/en.json" with { type: "json" };
import es from "../locales/es.json" with { type: "json" };
import { competitionStageName, createI18n } from "../src/index";

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

it.each([
	["es", "Play-in, ronda 1, serie 1", "Fase eliminatoria"],
	["en", "Play-in, round 1, series 1", "Knockout stage"],
])(
	"resolves separate competition stage labels in %s",
	async (locale, playIn, knockout) => {
		const { t } = await createI18n(locale);
		expect(
			competitionStageName(
				t,
				{ split: "winter", stage: "playInRound1Match1" },
				"Fallback",
			),
		).toEqual({ split: "Winter Split", stage: playIn });
		expect(competitionStageName(t, { stage: "knockout" }, "Fallback")).toEqual({
			split: undefined,
			stage: knockout,
		});
		expect(competitionStageName(t, undefined, "Fallback")).toEqual({
			split: undefined,
			stage: "Fallback",
		});
		expect(competitionStageName(t, { stage: "custom" }, "Fallback")).toEqual({
			split: undefined,
			stage: "Fallback",
		});
	},
);

const causeCatalogs: Record<"es" | "en", Record<string, string>> = { es, en };

it.each(["es", "en"] as const)(
	"translates every match cause in the %s event feed",
	(locale) => {
		const catalog = causeCatalogs[locale];
		const missing = MATCH_CAUSE_KEYS.filter(
			(key) => !catalog[`draft.match.cause.${key}`]?.trim(),
		);
		expect(missing).toEqual([]);
	},
);

it("phrase every match cause in the game result too", () => {
	// The live feed lists every cause the simulation gives; the result's
	// decisive disputes must phrase the same ones instead of showing the id.
	for (const catalog of [es, en]) {
		const missing = Object.keys(catalog)
			.filter((key) => key.startsWith("draft.match.cause."))
			.map((key) => key.replace("draft.match.cause.", "draft.result.cause."))
			.filter((key) => !Object.hasOwn(catalog, key));
		expect(missing).toEqual([]);
	}
});
