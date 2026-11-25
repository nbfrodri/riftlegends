import { expect, test } from "vitest";
import { buildBirthDates, parseBirthDate } from "./birthdate.ts";

test("a full date is kept as it is", () => {
	expect(parseBirthDate("1996-05-07")).toBe("1996-05-07");
	expect(parseBirthDate(" 2004-01-31 ")).toBe("2004-01-31");
});

test("a year alone, or the first of January that Leaguepedia uses for it, becomes a year", () => {
	expect(parseBirthDate("1999")).toBe("1999");
	expect(parseBirthDate("1996-01-01")).toBe("1996");
});

test("empty, missing and impossible dates give nothing", () => {
	for (const value of [undefined, null, "", "  ", "unknown", "1996-02-30", "1996-13-01", "0000-00-00", "1850-05-05", "2090-01-02"])
		expect(parseBirthDate(value), String(value)).toBeUndefined();
});

test("each snapshot player gets one date; the most precise one wins across rows", () => {
	const result = buildBirthDates(
		[
			{ Link: "Faker", Birthdate: "1996-01-01" },
			{ Link: "Faker", Birthdate: "1996-05-07" },
			{ Link: "Kiin", Birthdate: "" },
			{ Link: "Chovy", Birthdate: "2001" },
			{ Link: "Stranger", Birthdate: "1990-02-02" },
		],
		["Faker", "Kiin", "Chovy"],
	);
	expect(result).toEqual([
		{ id: "Chovy", birthDate: "2001" },
		{ id: "Faker", birthDate: "1996-05-07" },
	]);
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	parseBirthDates,
	preserveBirthDates,
	serializeBirthDates,
} from "./birthdate.ts";

const file = (birthDate: string, retrievedAt = "2026-11-25") => ({
	provenance: {
		source: "Leaguepedia",
		domain: "lol.fandom.com",
		retrievedAt,
		licence: "CC BY-SA 3.0",
		attribution: "x",
		queries: [{ url: "https://x", retrievedAt }],
	},
	players: [{ id: "Faker", birthDate }],
});

test("the file round-trips, rejects bad dates and ignores only retrieval dates", async () => {
	const body = serializeBirthDates(file("1996-05-07"));
	expect(parseBirthDates(body)).toEqual(file("1996-05-07"));
	expect(() => parseBirthDates(serializeBirthDates(file("1996-5-7")))).toThrow();
	const dir = await mkdtemp(join(tmpdir(), "rift-birthdates-"));
	try {
		const path = join(dir, "birthdates.json");
		const { writeFile } = await import("node:fs/promises");
		await writeFile(path, body);
		expect(await preserveBirthDates(path, file("1996-05-07", "2026-12-01"))).toBe(body);
		expect(await preserveBirthDates(path, file("1996"))).toBe(
			serializeBirthDates(file("1996")),
		);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
