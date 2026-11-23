import { readdirSync, readFileSync, statSync } from "node:fs";
import { expect, test } from "vitest";

// Native scrollbars are styled once, with ::-webkit-scrollbar rules in the
// global CSS. Since Chromium 121 a non-auto `scrollbar-color` or
// `scrollbar-width` overrides those rules, so no scroller may set them
// (except `scrollbar-width: none`, which hides the bar on purpose).

const root = new URL("../../../", import.meta.url);

function sources(dir: URL): { file: string; source: string }[] {
	return readdirSync(dir).flatMap((name) => {
		if (name === "node_modules" || name === "dist") return [];
		const url = new URL(name, dir);
		if (statSync(url).isDirectory()) return sources(new URL(`${name}/`, dir));
		if (!/\.(tsx?|css)$/.test(name) || /\.test\./.test(name)) return [];
		// Comments may name the properties; only code counts.
		const source = readFileSync(url, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		return [{ file: url.pathname, source }];
	});
}

test("the global CSS styles every native scrollbar in the Caja style", () => {
	const css = readFileSync(new URL("packages/ui-kit/styles.css", root), "utf8");
	expect(css).toMatch(/::-webkit-scrollbar\s*\{[^}]*width:\s*8px/);
	expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*--color-line/);
	expect(css).toMatch(/::-webkit-scrollbar-thumb:hover\s*\{[^}]*--color-muted/);
	expect(css).toMatch(/::-webkit-scrollbar-button[^{]*\{[^}]*display:\s*none/);
});

test("no scroller overrides the global scrollbar style", () => {
	const files = [
		...sources(new URL("packages/ui-kit/", root)),
		...sources(new URL("apps/desktop/src/", root)),
	];
	for (const { file, source } of files) {
		expect(source, file).not.toMatch(/scrollbar-color/);
		expect(source, file).not.toMatch(/scrollbar-width:(?!\s*none)/);
	}
});
