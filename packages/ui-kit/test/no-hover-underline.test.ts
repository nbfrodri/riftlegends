import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// #399: hovering a control changes its fill or border (#376), never underlines
// its text.
const hoverUnderline =
	/(?:^|[\s"'`])((?:[\w-]+:|\[[^\]\s]*\]:)*(?:group-|peer-)?hover:(?:[\w-]+:|\[[^\]\s]*\]:)*(?:underline|decoration-[\w-]+))(?=[\s"'`])|:hover[^{]*\{[^}]*text-decoration(?:-line)?:\s*underline/g;

function violations(source: string) {
	return [...source.matchAll(hoverUnderline)].map(
		([match, token]) => token ?? match.trim(),
	);
}

test("the guard spots hover underlines in classes and CSS", () => {
	expect(
		violations(
			'"hover:not-data-disabled:underline group-hover:underline hover:bg-surface underline-offset-3 aria-selected:underline" a:hover { text-decoration: underline }',
		),
	).toEqual([
		"hover:not-data-disabled:underline",
		"group-hover:underline",
		":hover { text-decoration: underline",
	]);
});

test("no desktop or ui-kit control underlines its text on hover", () => {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const files = globSync(
		["apps/desktop/src/**/*.{ts,tsx,css}", "packages/ui-kit/**/*.{ts,tsx,css}"],
		{ cwd: root, exclude: ["**/node_modules/**", "**/dist/**", "**/test/**"] },
	);
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) =>
		violations(readFileSync(join(root, path), "utf8")).map(
			(token) => `${path}: ${token}`,
		),
	);
	expect(found).toEqual([]);
});
