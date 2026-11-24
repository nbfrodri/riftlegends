import { readFileSync } from "node:fs";
import { validateFormat } from "@rift-legends/contracts";
import { realInternationalsSchema } from "@rift-legends/contracts/real-internationals";
import { describe, expect, it } from "vitest";
import { checkInternational } from "./international-check.ts";
import {
	buildInternationalFormats,
	internationalFormatFiles,
	unverifiedFormats,
} from "./international-formats.ts";

const content = new URL("../../packages/core/content/real/", import.meta.url);
const data = realInternationalsSchema.parse(
	JSON.parse(readFileSync(new URL("internationals.json", content), "utf8")),
);
const formats = buildInternationalFormats(data);
const event = (id: string) => {
	const found = data.events.find((e) => e.id === id);
	if (!found) throw new Error(`No ${id}`);
	return found;
};
const clone = <T>(value: T): T => structuredClone(value);

describe("V1 the 2026 international formats pass the validation", () => {
	it("builds First Stand, MSI and Worlds as valid competitions", () => {
		expect(Object.keys(formats)).toEqual(["first-stand", "msi", "worlds"]);
		for (const [id, competition] of Object.entries(formats)) {
			const result = validateFormat(competition);
			expect(result, id).toMatchObject({ ok: true });
			expect(competition.id).toBe(id);
			expect(competition.kind).toBe("international");
		}
	});

	it("keeps the generated files in content/real/formats up to date", () => {
		for (const [file, competition] of Object.entries(
			internationalFormatFiles(formats),
		)) {
			expect(readFileSync(new URL(`formats/${file}`, content), "utf8")).toBe(
				`${JSON.stringify(competition, null, "\t")}\n`,
			);
		}
	});

	it("gives every stage a window that covers its real dates", () => {
		for (const { id, matches } of data.events) {
			const first = matches[0]?.date as string;
			const year = Number(first.slice(0, 4));
			const day = (date: string) =>
				Math.floor((Date.parse(date) - Date.UTC(year, 0, 1)) / 86_400_000);
			const stages = formats[id as keyof typeof formats].stages;
			// The first and last series of the event sit inside the first and last window.
			const starts = stages.map((s) => s.window.startWeek);
			expect(Math.floor(day(first) / 7)).toBe(Math.min(...starts));
			const ends = stages.map((s) => s.window.startWeek + s.window.weeks);
			const last = matches.at(-1)?.date as string;
			expect(Math.floor(day(last) / 7) + 1).toBe(Math.max(...ends));
		}
	});
});

describe("R1 each format reproduces the 2026 series", () => {
	for (const id of ["first-stand", "msi", "worlds"] as const) {
		it(`${id}: teams, series per stage and Bo per round match`, () => {
			expect(checkInternational(event(id), formats[id])).toEqual([]);
		});
	}

	it("worlds: 16 teams play a Swiss to 3 wins or 3 losses, then 8 play a Bo5 bracket", () => {
		const stages = formats.worlds.stages;
		expect(stages.map((s) => s.play.type)).toEqual([
			"doubleElim",
			"swiss",
			"singleElim",
		]);
		expect(stages[1]?.play).toMatchObject({
			size: 16,
			wins: 3,
			losses: 3,
			bestOf: 1,
			decisiveBestOf: 3,
		});
	});

	it("detects a changed Bo", () => {
		const changed = clone(event("msi"));
		const final = changed.matches.at(-1);
		if (!final) throw new Error("no final");
		Object.assign(final, { bestOf: 3, score1: 2, score2: 0 });
		expect(checkInternational(changed, formats.msi).join("\n")).toMatch(
			/best of/i,
		);
	});

	it("detects a pairing the bracket does not allow", () => {
		const changed = clone(event("worlds"));
		const quarter = changed.matches.find((m) => m.tab === "Semifinals");
		if (!quarter) throw new Error("no semifinal");
		quarter.team2 = "Cloud9";
		expect(checkInternational(changed, formats.worlds).length).toBeGreaterThan(
			0,
		);
	});

	it("detects a series that no stage describes", () => {
		const changed = clone(event("first-stand"));
		const extra = clone(changed.matches[0]);
		if (!extra) throw new Error("no series");
		extra.tab = "Wildcard";
		extra.id = "extra";
		changed.matches.push(extra);
		expect(checkInternational(changed, formats["first-stand"]).join("\n")).toMatch(
			/no stage/i,
		);
	});

	it("detects a team count that differs from the stage size", () => {
		const changed = clone(event("worlds"));
		changed.matches = changed.matches.filter(
			(m) => !(m.tab === "Quarterfinals" && m.team1 === "Gen.G"),
		);
		expect(checkInternational(changed, formats.worlds).join("\n")).toMatch(
			/teams/i,
		);
	});
});

describe("R2 unconfirmed data is marked and listed", () => {
	it("marks the formats as not verified and lists the reasons", () => {
		const list = unverifiedFormats(formats);
		expect(list.map(({ id }) => id)).toEqual(["first-stand", "msi", "worlds"]);
		for (const { id, reasons } of list) {
			expect(formats[id as keyof typeof formats].verified).toBe(false);
			expect(reasons.length).toBeGreaterThan(0);
		}
	});

	it("lists a format only while it is not verified", () => {
		const verified = {
			...clone(formats.msi),
			verified: true,
		} as typeof formats.msi;
		expect(
			unverifiedFormats({ ...formats, msi: verified }).map(({ id }) => id),
		).toEqual(["first-stand", "worlds"]);
	});

	it("records that First Stand groups end without a grand final", () => {
		const reasons = unverifiedFormats(formats).find(
			({ id }) => id === "first-stand",
		)?.reasons;
		expect(reasons?.join(" ")).toMatch(/grand final/i);
	});
});

describe("Q4 international seeding by region pots", () => {
	it("worlds draws its Swiss from the six leagues in four pots", () => {
		const swiss = formats.worlds.stages.find((s) => s.play.type === "swiss");
		expect(swiss?.entrants).toEqual({
			kind: "pots",
			from: ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"],
			pots: 4,
		});
		expect(swiss?.play).toMatchObject({
			round1: "pots",
			avoid: ["region", "rematch"],
		});
	});

	it("takes the knockout of Worlds from the top eight of the Swiss", () => {
		const knockout = formats.worlds.stages.at(-1);
		expect(knockout?.entrants).toEqual({
			kind: "standing",
			stage: "swiss",
			from: 1,
			to: 8,
		});
	});
});
