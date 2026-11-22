import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { writeLogos } from "./logos.ts";
import { snapshot } from "./snapshot.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

try {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			"cache-dir": { type: "string" },
			"max-attempts": { type: "string" },
			offline: { type: "boolean", default: false },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		console.log(
			"pnpm data:snapshot [--offline] [--cache-dir <path>] [--max-attempts <n>]\npnpm data:logos [--offline] [--cache-dir <path>] [--max-attempts <n>]",
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
		const outputDir = join(root, "packages/core/content/real");
		if (positionals[0] === "logos") {
			const result = await writeLogos({
				cacheDir,
				outputDir,
				offline: values.offline,
				maxAttempts: Number(values["max-attempts"] ?? "5"),
				fetch: (input, options) => {
					console.error(`Fetching ${new URL(String(input)).pathname}`);
					return fetch(input, options);
				},
			});
			console.log(`${result.logos} of ${result.teams.length} logos`);
			for (const miss of result.unmatched)
				console.log(`unmatched ${miss.league} ${miss.team}: ${miss.reason}`);
		} else {
			const result = await snapshot({
				cacheDir,
				outputDir,
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
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
