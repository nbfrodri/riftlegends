import { describe, expect, it } from "vitest";
import { resolveLocale } from "../src/index";

describe("resolveLocale", () => {
	it.each([
		["es-ES", "es"],
		["es-419", "es"],
		["en-US", "en"],
		["en", "en"],
		["fr-FR", "en"],
		["", "en"],
	])("%j -> %s", (input, expected) => {
		expect(resolveLocale(input)).toBe(expected);
	});
});
