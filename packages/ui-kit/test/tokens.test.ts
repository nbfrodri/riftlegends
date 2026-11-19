import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

function readTokens() {
	const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
	return Object.fromEntries(
		Array.from(css.matchAll(/--([\w-]+):\s*([^;]+);/g), ([, name, value]) => [
			name,
			value,
		]),
	);
}

test("T1: Caja theme matches ADR 0002", () => {
	expect(readTokens()).toMatchObject({
		"color-canvas": "#101420",
		"color-panel": "#191f2f",
		"color-surface": "#222b3e",
		"color-text": "#f4f6ff",
		"color-muted": "#b6c0d2",
		"color-action": "#a8deff",
		"color-on-action": "#101828",
		"color-side-blue": "#88d6ff",
		"color-side-red": "#ff9eab",
		"radius-control": "2px",
	});
});

function luminance(hex: string) {
	const linear = (offset: number) => {
		const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return channel <= 0.04045
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

test("T2: every Caja text/background pair meets AA for normal text", () => {
	const tokens = readTokens();
	const pairs = ["canvas", "panel", "surface"].flatMap((background) =>
		["text", "muted", "action", "side-blue", "side-red"].map(
			(foreground) => [foreground, background] as const,
		),
	);
	pairs.push(["on-action", "action"]);
	for (const [foreground, background] of pairs) {
		const a = luminance(tokens[`color-${foreground}`]);
		const b = luminance(tokens[`color-${background}`]);
		expect(
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			`${foreground} on ${background}`,
		).toBeGreaterThanOrEqual(4.5);
	}
});
