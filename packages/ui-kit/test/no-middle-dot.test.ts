import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// No UI text uses the middle dot as a separator (#586): texts join their
// parts with words, or with visual hierarchy (two lines, size, colour).
const middleDot = "·";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function withoutComments(source: string) {
	return source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
}

test("no catalogue text contains a middle dot", () => {
	const files = globSync("packages/i18n/locales/*.json", { cwd: root });
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) => {
		const catalogue = JSON.parse(
			readFileSync(join(root, path), "utf8"),
		) as Record<string, string>;
		return Object.entries(catalogue)
			.filter(([, value]) => value.includes(middleDot))
			.map(([key, value]) => `${path}: ${key} = ${value}`);
	});
	expect(found).toEqual([]);
});

test("no desktop or ui-kit source text contains a middle dot", () => {
	const files = globSync(
		[
			"apps/desktop/src/**/*.{ts,tsx,svg,html}",
			"packages/ui-kit/**/*.{ts,tsx}",
		],
		{ cwd: root, exclude: ["**/node_modules/**", "**/dist/**", "**/test/**"] },
	);
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) =>
		withoutComments(readFileSync(join(root, path), "utf8"))
			.split("\n")
			.filter((line) => line.includes(middleDot))
			.map((line) => `${path}: ${line.trim()}`),
	);
	expect(found).toEqual([]);
});
