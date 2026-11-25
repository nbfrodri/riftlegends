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
