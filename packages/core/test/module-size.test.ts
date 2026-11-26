import { globSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { expect, test } from "vitest";

const MAX_LINES = 300;
const exceptions: Readonly<Record<string, string>> = {
	"match/composition/identities.ts":
		"Keeps the composition identity rule table alongside its detector.",
};

test("keeps core modules within 300 lines", () => {
	const root = join(import.meta.dirname, "..");
	const oversized = globSync("**/*.ts", {
		cwd: root,
		exclude: ["**/node_modules/**", "**/*.test.ts"],
	})
		.sort()
		.flatMap((file) => {
			const path = file.split(sep).join("/");
			const source = readFileSync(join(root, file), "utf8");
			const lines =
				source.split(/\r?\n/).length - Number(source.endsWith("\n"));
			return lines > MAX_LINES && !Object.hasOwn(exceptions, path)
				? [`${path} (${lines} lines)`]
				: [];
		});
	expect(oversized).toEqual([]);
});
