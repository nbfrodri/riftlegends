import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { snapshot } from "./snapshot.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

try {
	const { values } = parseArgs({
		options: {
			"cache-dir": { type: "string" },
			"max-attempts": { type: "string" },
			offline: { type: "boolean", default: false },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		console.log(
			"pnpm data:snapshot [--offline] [--cache-dir <path>] [--max-attempts <n>]",
		);
	} else {
		const cacheDir = resolve(
			values["cache-dir"] ??
				process.env.RIFT_LEGENDS_DATA_CACHE ??
				join(
					process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
					"rift-legends",
					"data-pipeline",
				),
		);
		const fromRoot = relative(root, cacheDir);
		if (
			!isAbsolute(fromRoot) &&
			fromRoot !== ".." &&
			!fromRoot.startsWith(`..${sep}`)
		) {
			throw new Error("The raw cache directory must be outside the repository");
		}
		const result = await snapshot({
			cacheDir,
			outputDir: join(root, "packages/core/content/real"),
			offline: values.offline,
			maxAttempts: Number(values["max-attempts"] ?? "5"),
			fetch: (input, options) => {
				const url = new URL(String(input));
				const table = url.searchParams.get("tables");
				const label = table
					? `${table} (offset ${url.searchParams.get("offset")})`
					: (url.searchParams.get("prop") ?? url.hostname);
				console.error(`Fetching ${label}`);
				return fetch(input, options);
			},
		});
		console.table(result.totals);
		console.log(JSON.stringify({ bytes: result.bytes, ...result.oddities }));
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
