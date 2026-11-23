import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// #376: a button says what it does in words; no arrow or chevron icons in it
// and no icon-only arrow buttons.
const arrow = /\b(?:Arrow|Chevron|MoveRight|MoveLeft)\w*\b/;

function violations(source: string) {
	const found: string[] = [];
	for (const [block] of source.matchAll(/<Button\b[\s\S]*?<\/Button>/g))
		if (arrow.test(block.replace(/aria-[\w-]+="[^"]*"/g, "")))
			found.push(block.match(arrow)?.[0] ?? "");
	for (const [, icon] of source.matchAll(/<IconButton\b[^>]*?icon=\{(\w+)\}/g))
		if (icon && arrow.test(icon)) found.push(icon);
	return found;
}

test("the guard spots arrows in buttons", () => {
	expect(
		violations(
			'<Button onClick={go}>{t("next")}<ArrowRight aria-hidden /></Button><IconButton icon={ArrowUpRight} label="x" /><Button>Skip<SkipForward /></Button>',
		),
	).toEqual(["ArrowRight", "ArrowUpRight"]);
});

test("no desktop or ui-kit button shows an arrow icon", () => {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const files = globSync(
		["apps/desktop/src/**/*.tsx", "packages/ui-kit/components/**/*.tsx"],
		{ cwd: root, exclude: ["**/node_modules/**", "**/dist/**"] },
	);
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) =>
		violations(readFileSync(join(root, path), "utf8")).map(
			(icon) => `${path}: ${icon}`,
		),
	);
	expect(found).toEqual([]);
});
