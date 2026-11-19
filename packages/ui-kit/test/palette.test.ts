import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const kit = new URL("../", import.meta.url);

const tokenColors = new Set([
	...Array.from(
		readFileSync(new URL("tokens.css", kit), "utf8").matchAll(
			/--color-([\w-]+):/g,
		),
		([, name]) => name,
	),
	"transparent",
	"current",
	"inherit",
]);

// Utilities sharing a colour prefix that set something other than a colour.
const notColours = new Set([
	...["xs", "sm", "base", "lg", "xl", "2xl", "table"],
	...["left", "center", "right", "wrap", "nowrap", "ellipsis", "clip"],
	...["solid", "dashed", "dotted", "none", "hidden", "offset"],
]);

const colourUtility =
	/(?:^|[\s:"'`])-?(?:bg|text|border(?:-[trblxy])?|outline|ring|fill|stroke|decoration|caret|accent|divide|shadow)-([a-z][\w-]*?)(?:\/\d+)?(?=[\s"'`])/g;

function componentSources() {
	const dir = new URL("components/", kit);
	return readdirSync(dir).map((file) => ({
		file,
		source: readFileSync(new URL(file, dir), "utf8"),
	}));
}

test("components only paint with Caja colour tokens", () => {
	for (const { file, source } of componentSources()) {
		const colours = Array.from(
			source.matchAll(colourUtility),
			([, colour = ""]) => colour,
		).filter((colour) => !notColours.has(colour.split("-")[0] ?? colour));
		expect(
			colours.filter((colour) => !tokenColors.has(colour)),
			file,
		).toEqual([]);
	}
});

test("components are dark only: no dark: or light-theme variants", () => {
	for (const { file, source } of componentSources()) {
		expect(source, file).not.toMatch(/\bdark:/);
	}
});
