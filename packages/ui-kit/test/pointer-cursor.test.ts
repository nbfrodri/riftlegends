import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// #399: everything clickable shows the hand cursor; a disabled control keeps
// the normal one. Covers native buttons and summaries, the Base UI primitives
// the ui-kit wraps and labels that act as controls (they carry `press`).
const clickable =
	/<(button|summary|label|ButtonPrimitive|Primitive\.Trigger|Primitive\.Item|Combobox\.Trigger|Combobox\.Item)\b/g;

/** The opening tag starting at `from`, up to its closing `>` outside braces. */
function openingTag(source: string, from: number) {
	let depth = 0;
	let quote: string | undefined;
	for (let i = from + 1; i < source.length; i++) {
		const char = source[i];
		if (quote) {
			if (char === quote) quote = undefined;
		} else if (char === "{") depth++;
		else if (char === "}") depth--;
		else if (depth === 0 && (char === '"' || char === "'")) quote = char;
		else if (depth === 0 && char === ">") return source.slice(from, i + 1);
	}
	return source.slice(from);
}

function violations(source: string) {
	const found: string[] = [];
	for (const match of source.matchAll(clickable)) {
		// A class list kept in a constant is read from its declaration.
		const tag = openingTag(source, match.index).replace(
			/className=\{(\w+)\}/,
			(attribute, name: string) =>
				source.match(new RegExp(`const ${name}\\s*=\\s*("[^"]*")`))?.[1] ??
				attribute,
		);
		if (match[1] === "label" && !/\bpress\b/.test(tag)) continue;
		const line = source.slice(0, match.index).split("\n").length;
		if (!tag.includes("cursor-pointer"))
			found.push(`${match[1]}:${line} without cursor-pointer`);
		if (/\b(?:disabled|aria-disabled|unavailable)\b/.test(tag)) {
			if (!tag.includes("cursor-default"))
				found.push(`${match[1]}:${line} disabled without cursor-default`);
		}
	}
	return found;
}

test("the guard spots clickables without the hand cursor", () => {
	expect(
		violations(
			[
				'<button onClick={() => go(a > b)} className="press">',
				'<button disabled={busy} className="cursor-pointer">',
				'<button className="cursor-pointer disabled:cursor-default" disabled>',
				'<label className="press relative">',
				'<label htmlFor={id} className="flex">',
				'<Primitive.Item className="flex">',
				"<summary className={summary}>",
				'const summary = "flex cursor-pointer";',
				"<button className={unknown}>",
			].join("\n"),
		),
	).toEqual([
		"button:1 without cursor-pointer",
		"button:2 disabled without cursor-default",
		"label:4 without cursor-pointer",
		"Primitive.Item:6 without cursor-pointer",
		"button:9 without cursor-pointer",
	]);
});

test("desktop and ui-kit clickables show the hand cursor, disabled ones the normal one", () => {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const files = globSync(
		["apps/desktop/src/**/*.tsx", "packages/ui-kit/components/**/*.tsx"],
		{ cwd: root, exclude: ["**/node_modules/**", "**/dist/**"] },
	);
	expect(files.length).toBeGreaterThan(0);
	const found = files.flatMap((path) =>
		violations(readFileSync(join(root, path), "utf8")).map(
			(problem) => `${path}: ${problem}`,
		),
	);
	expect(found).toEqual([]);
});
