import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// No text in the app is underlined, links included: a link reads as one by
// its colour, a button by its fill (#376, #399). The base CSS resets `<a>`
// and no class or rule may bring the underline back.
const underline =
	/(?:^|[\s"'`])((?:[\w-]+:|\[[^\]\s]*\]:)*underline)(?=[\s"'`])|text-decoration(?:-line)?:\s*underline/g;

function violations(source: string) {
	return [...source.matchAll(underline)].map(
		([match, token]) => token ?? match.trim(),
	);
}

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("the guard spots underline classes and CSS, not their opposites", () => {
	expect(
		violations(
			'"underline hover:underline no-underline underline-offset-3 aria-current:underline" a { text-decoration: underline }',
		),
	).toEqual([
		"underline",
		"hover:underline",
		"aria-current:underline",
		"text-decoration: underline",
	]);
});

test("the base CSS removes the underline from every link", () => {
	const css = readFileSync(join(root, "packages/ui-kit/styles.css"), "utf8");
	expect(css).toMatch(
		/@layer base\s*\{[\s\S]*\ba\s*\{[^}]*text-decoration:\s*none/,
	);
});

test("no desktop or ui-kit element is underlined", () => {
	const files = globSync(
		["apps/desktop/src/**/*.{ts,tsx,css}", "packages/ui-kit/**/*.{ts,tsx,css}"],
		{ cwd: root, exclude: ["**/node_modules/**", "**/dist/**", "**/test/**"] },
	);
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) =>
		violations(
			readFileSync(join(root, path), "utf8").replace(
				/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,
				"",
			),
		).map((token) => `${path}: ${token}`),
	);
	expect(found).toEqual([]);
});
