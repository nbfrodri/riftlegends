import { createI18n } from "@rift-legends/i18n";
import { describe, expect, it } from "vitest";
import { whereText } from "../src/renderer/competition/team/team-text";

// Plan 31, U8: a series of the team page names its competition and its stage
// with the real names of the format (#597), in the UI language.

const overview = {
	competitions: [
		{
			id: "LCK",
			stages: [
				{
					stage: "cup-groups",
					name: { split: "winter" as const, stage: "groupA" },
				},
			],
		},
	],
};

describe("where a series of the team page was played", () => {
	it("uses the stage name of the format, in Spanish", async () => {
		const i18n = await createI18n("es-ES");
		expect(
			whereText(i18n.t, overview, { competition: "LCK", stage: "cup-groups" }),
		).toBe("LCK, Winter Split, Grupo A");
	});

	it("falls back to the stage id as a title", async () => {
		const i18n = await createI18n("en-US");
		expect(
			whereText(i18n.t, overview, { competition: "LCK", stage: "playoffs" }),
		).toBe("LCK, Playoffs");
	});
});
