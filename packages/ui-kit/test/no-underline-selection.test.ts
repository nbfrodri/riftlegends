import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// #376: a selected or active control is marked with a fill or a full border,
// never with a line under it (underline, bottom border or bottom inset shadow).
const bottomLine =
	/(?:^|[\s"'`])((?:[\w-]+:|\[[^\]\s]*\]:)*(?:border-b(?:-[\w[\]-]+)?|shadow-\[inset_0_-[^\]\s]*\]|underline|decoration-[\w-]+))(?=[\s"'`])/g;
const selected =
	/(?:^|:)(?:peer-|group-)?(?:checked|aria-selected|aria-pressed|aria-current|aria-checked|data-selected|data-active|data-checked|data-state|has-\[:checked\])/;

function violations(source: string) {
	const found: string[] = [];
	for (const [, token] of source.matchAll(bottomLine)) {
		if (!token) continue;
		const variants = token.split(":").slice(0, -1).join(":");
		const utility = token.split(":").at(-1) ?? "";
		// A thick bottom border or a bottom inset line is only ever a selection mark.
		const marker =
			/^border-b-(?:[2-9]|\[)/.test(utility) || utility.startsWith("shadow-");
		if (marker || selected.test(`:${variants}`)) found.push(token);
	}
	return found;
}

test("the guard spots the old selection marks", () => {
	expect(
		violations(
			'"peer-checked:shadow-[inset_0_-2px_var(--color-action)] -mb-px border-b-2 aria-selected:underline hover:underline border-b"',
		),
	).toEqual([
		"peer-checked:shadow-[inset_0_-2px_var(--color-action)]",
		"border-b-2",
		"aria-selected:underline",
	]);
});

test("no desktop or ui-kit control marks its selection with a bottom line", () => {
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
