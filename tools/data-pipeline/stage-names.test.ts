import { readFileSync } from "node:fs";
import { competitionSchema } from "@rift-legends/contracts/competition-format";
import { realInternationalsSchema } from "@rift-legends/contracts/real-internationals";
import { expect, test } from "vitest";
import en from "../../packages/i18n/locales/en.json";
import es from "../../packages/i18n/locales/es.json";
import { buildInternationalFormats } from "./international-formats.ts";
import { buildLeagueFormats } from "./league-formats.ts";

const content = new URL("../../packages/core/content/real/", import.meta.url);
const read = (file: string): unknown =>
	JSON.parse(readFileSync(new URL(file, content), "utf8"));
const splits = ["winter", "spring", "summer"] as const;
const splitNames = ["Winter Split", "Spring Split", "Summer Split"];
const formats = [
	...Object.values(buildLeagueFormats()),
	...Object.values(
		buildInternationalFormats(
			realInternationalsSchema.parse(read("internationals.json")),
		),
	),
];

test.each(formats)(
	"$id generates the same named stages as the shipped format",
	(format) => {
		const shipped = competitionSchema.parse(
			read(`formats/${format.id.toLowerCase()}.json`),
		);
		expect(shipped.stages).toEqual(format.stages);
		for (const stage of shipped.stages) {
			expect(stage, stage.id).toHaveProperty("name.stage", expect.any(String));
			if (format.kind === "league") {
				expect(stage, stage.id).toHaveProperty(
					"name.split",
					expect.stringMatching(/^(winter|spring|summer)$/),
				);
			} else {
				expect(stage, stage.id).not.toHaveProperty("name.split");
			}
			for (const catalog of [en, es] as Record<string, string>[]) {
				const label = catalog[`competition.stage.${stage.name?.stage}`];
				expect(label, stage.id).toMatch(/\S/);
				expect(label, stage.id).not.toContain("\u00b7");
			}
		}
	},
);

test.each(formats.filter(({ kind }) => kind === "league"))(
	"$id has winter, spring and summer stages in calendar order",
	({ stages }) => {
		const windows = splits.map((split) =>
			stages
				.filter(({ name }) => name?.split === split)
				.map(({ window }) => window.startWeek),
		);
		for (const weeks of windows) expect(weeks.length).toBeGreaterThan(0);
		for (const [index, weeks] of windows.slice(1).entries()) {
			expect(Math.max(...(windows[index] ?? []))).toBeLessThan(
				Math.min(...weeks),
			);
		}
	},
);

test("the split names stay in English in both catalogs", () => {
	for (const catalog of [en, es] as Record<string, string>[]) {
		expect(
			splits.map((split) => catalog[`competition.split.${split}`]),
		).toEqual(splitNames);
	}
});
