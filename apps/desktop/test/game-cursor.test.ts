import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// #515: one global rule gives the whole app the game cursors (Kenney, CC0).
const renderer = new URL("../src/renderer/", import.meta.url);
const css = readFileSync(new URL("styles.css", renderer), "utf8");

test("the cursors are bundled files, with 1x and 2x images", () => {
	for (const name of ["arrow", "arrow@2x", "pointer", "pointer@2x"])
		expect(existsSync(new URL(`public/cursors/${name}.png`, renderer))).toBe(
			true,
		);
	expect(existsSync(new URL("public/cursors/License.txt", renderer))).toBe(
		true,
	);
});

test("the arrow is the default cursor with a hotspot and a system fallback", () => {
	expect(css).toMatch(
		/--cursor-arrow:\s*image-set\(\s*url\("[^"]*arrow\.png"\)\s*1x,\s*url\("[^"]*arrow@2x\.png"\)\s*2x\s*\)\s+\d+\s+\d+,\s*default;/,
	);
	expect(css).toMatch(/cursor:\s*var\(--cursor-arrow\)/);
});

test("the hand replaces pointer with a pointer fallback", () => {
	expect(css).toMatch(
		/--cursor-pointer:\s*image-set\(\s*url\("[^"]*pointer\.png"\)\s*1x,\s*url\("[^"]*pointer@2x\.png"\)\s*2x\s*\)\s+\d+\s+\d+,\s*pointer;/,
	);
	expect(css).toMatch(
		/@utility cursor-pointer\s*\{\s*cursor:\s*var\(--cursor-pointer,\s*pointer\);/,
	);
	expect(css).toMatch(
		/@utility cursor-default\s*\{\s*cursor:\s*var\(--cursor-arrow,\s*default\);/,
	);
});

test("the game cursors apply unless the setting turns them off", () => {
	expect(css).toContain(':root:not([data-game-cursor="off"])');
});

test("text, not-allowed and resize cursors stay the system ones", () => {
	expect(css).not.toMatch(/@utility cursor-(text|not-allowed|\w*resize)/);
});

test("the cursor images come from files, never inlined or remote", () => {
	expect(css).not.toMatch(/url\(\s*["']?(data:|https?:)/);
});

test("the author is listed with the assets", () => {
	const licence = readFileSync(
		new URL("public/cursors/License.txt", renderer),
		"utf8",
	);
	expect(licence).toMatch(/Kenney/);
	expect(licence).toMatch(/CC0/);
});
