import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// #376: one press state for every control. It darkens and sinks 1 px, never on
// a disabled control, and with reduced motion it only darkens.
test("the press utility darkens and sinks enabled controls, without motion when reduced", () => {
	const css = readFileSync(
		new URL("../styles.css", import.meta.url),
		"utf8",
	).replace(/\/\*[\s\S]*?\*\//g, "");
	const press = css.match(/@utility press\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
	expect(press).toMatch(
		/&:active:not\(:disabled, \[data-disabled\], \[aria-disabled="true"\]\)\s*\{[^}]*filter:\s*brightness\(0\.88\);[^}]*translate:\s*0 1px;/,
	);
	expect(press).toMatch(
		/@media \(prefers-reduced-motion: reduce\)\s*\{\s*&:active\s*\{\s*translate:\s*none;/,
	);
});
