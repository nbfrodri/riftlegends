import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("restricts the renderer to local resources and cached asset images", () => {
	const html = readFileSync(
		new URL("../src/renderer/index.html", import.meta.url),
		"utf8",
	);
	const policy = html.match(
		/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
	)?.[1];
	expect(
		policy
			?.split(";")
			.map((directive) => directive.trim())
			.filter(Boolean)
			.sort(),
	).toEqual([
		"base-uri 'none'",
		"default-src 'none'",
		"font-src 'self'",
		"form-action 'none'",
		"img-src 'self' rl-asset:",
		"script-src 'self'",
		"style-src 'self'",
	]);
});
