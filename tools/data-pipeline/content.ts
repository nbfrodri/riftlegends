import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { parseHistory } from "./history.ts";
import { buildPlayerTeamContent } from "./player-team-content.ts";
import { leagues } from "./scope.ts";

const dir = fileURLToPath(
	new URL("../../packages/core/content/real/", import.meta.url),
);

/** One compact line per player and team keeps the diffs small. */
export function serializeRows(rows: readonly unknown[]) {
	return `[\n${rows.map((row) => `\t${JSON.stringify(row)}`).join(",\n")}\n]\n`;
}

export async function buildContent(inputDir = dir) {
	const snapshots = await Promise.all(
		leagues.map(async ({ id }) =>
			realSnapshotSchema.parse(
				JSON.parse(
					await readFile(join(inputDir, `${id.toLowerCase()}.json`), "utf8"),
				),
			),
		),
	);
	const careers = new Map(
		parseHistory(
			await readFile(join(inputDir, "history.json"), "utf8"),
		).players.map(({ id, seasons }) => [id, seasons]),
	);
	const { players, teams, provenance } = buildPlayerTeamContent(
		snapshots,
		careers,
	);
	return {
		"players.json": serializeRows(players),
		"teams.json": serializeRows(teams),
		"provenance.json": `${JSON.stringify(provenance, null, "\t")}\n`,
	};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	for (const [file, body] of Object.entries(await buildContent()))
		await writeFile(join(dir, file), body);
}
