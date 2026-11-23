import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { championFiles } from "./champions.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const realDir = join(root, "packages/core/content/real");

try {
	const { values } = parseArgs({
		options: {
			"cache-dir": { type: "string" },
			"prior-games": { type: "string" },
			offline: { type: "boolean", default: false },
		},
	});
	const { counts, missingSeasons } = await championFiles({
		cacheDir: resolve(
			values["cache-dir"] ??
				process.env.RIFT_LEGENDS_DATA_CACHE ??
				join(
					process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
					"rift-legends",
					"data-pipeline",
				),
		),
		snapshotDir: realDir,
		outputDir: join(realDir, "champions"),
		offline: values.offline,
		priorGames:
			values["prior-games"] !== undefined
				? Number(values["prior-games"])
				: undefined,
	});
	console.table(counts);
	if (missingSeasons.length)
		console.warn(
			`Champion tier history unavailable: ${missingSeasons.join(", ")}`,
		);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
