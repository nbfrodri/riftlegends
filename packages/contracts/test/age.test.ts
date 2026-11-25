import { expect, test } from "vitest";
import { ageOn, BIRTH_DATE } from "../age";

test("the age counts whole years up to the game date", () => {
	expect(ageOn("1996-05-07", "2027-06-18")).toBe(31);
	expect(ageOn("2004-01-31", "2027-06-18")).toBe(23);
});

test("the birthday itself adds the year; the day before does not", () => {
	expect(ageOn("2000-06-18", "2027-06-18")).toBe(27);
	expect(ageOn("2000-06-19", "2027-06-18")).toBe(26);
	expect(ageOn("2000-06-17", "2027-06-18")).toBe(27);
});

test("it grows with the game date, never with the system clock", () => {
	expect(ageOn("2000-06-18", "2028-06-17")).toBe(27);
	expect(ageOn("2000-06-18", "2028-06-18")).toBe(28);
});

test("a leap-day birthday turns a year older on 1 March in common years", () => {
	expect(ageOn("2000-02-29", "2027-02-28")).toBe(26);
	expect(ageOn("2000-02-29", "2027-03-01")).toBe(27);
	expect(ageOn("2000-02-29", "2028-02-29")).toBe(28);
});

test("a year-only birth date gives the difference of years", () => {
	expect(ageOn("1999", "2027-06-18")).toBe(28);
});

test("no birth date, or one after the game date, gives no age", () => {
	expect(ageOn(undefined, "2027-06-18")).toBeUndefined();
	expect(ageOn("2030-01-01", "2027-06-18")).toBeUndefined();
});

test("the birth date contract accepts a full date or a year and nothing else", () => {
	for (const ok of ["1996-05-07", "1999"]) expect(BIRTH_DATE.test(ok)).toBe(true);
	for (const bad of ["", "96", "1996-5-7", "1996-13-01", "1996-02-30", "1996-05"])
		expect(BIRTH_DATE.test(bad), bad).toBe(false);
});
