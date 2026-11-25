import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "./client.ts";
import { history } from "./history.ts";
import { internationals } from "./internationals.ts";
import { writeLeagueFormats } from "./league-formats.ts";
import { writeLeagueLogos } from "./league-logos.ts";
import { writeLogos } from "./logos.ts";
import { nationalities } from "./nationality.ts";
import { writePhotos } from "./photos.ts";
import { seasonOf } from "./season.ts";
import { snapshot } from "./snapshot.ts";
import { writeTimelines } from "./timelines.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Year of the six league snapshots: the season the international events share. */
async function snapshotSeason(dir: string) {
	const snapshots = await Promise.all(
		["cblol", "lck", "lcp", "lcs", "lec", "lpl"].map(async (league) =>
			JSON.parse(await readFile(join(dir, `${league}.json`), "utf8")),
		),
	);
	const season = seasonOf(snapshots);
	if (!season) throw new Error("The league snapshots have no season");
	return season;
}

try {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			"cache-dir": { type: "string" },
			"max-attempts": { type: "string" },
			offline: { type: "boolean", default: false },
			through: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		console.log(
			"pnpm data:(snapshot|logos|photos|leagues|league-formats|internationals|timelines) [--offline] [--cache-dir <path>] [--max-attempts <n>]",
		);
	} else if (positionals[0] === "league-formats") {
		writeLeagueFormats();
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
		const historyDir = resolve(
			process.env.RIFT_LEGENDS_HISTORY_CACHE ?? join(cacheDir, "history"),
		);
		const timelinesDir = resolve(
			process.env.RIFT_LEGENDS_TIMELINES_CACHE ?? join(cacheDir, "timelines"),
		);
		for (const dir of [cacheDir, historyDir, timelinesDir]) {
			const fromRoot = relative(root, dir);
			if (
				!isAbsolute(fromRoot) &&
				fromRoot !== ".." &&
				!fromRoot.startsWith(`..${sep}`)
			) {
				throw new Error(
					"The raw cache directory must be outside the repository",
				);
			}
		}
		const outputDir = join(root, "packages/core/content/real");
		const imageOptions = {
			cacheDir,
			outputDir,
			offline: values.offline,
			maxAttempts: Number(values["max-attempts"] ?? "5"),
			fetch: ((input, options) => {
				console.error(`Fetching ${new URL(String(input)).pathname}`);
				return fetch(input, options);
			}) satisfies typeof fetch,
		};
		if (positionals[0] === "photos") {
			const result = await writePhotos(imageOptions);
			console.log(`${result.photos} of ${result.players} player photos`);
			for (const miss of result.unmatched)
				console.log(`unmatched ${miss.player}: ${miss.reason}`);
		} else if (positionals[0] === "timelines") {
			const season = await snapshotSeason(outputDir);
			const through = values.through ?? new Date().toISOString().slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(through))
				throw new Error("--through must be a UTC day (YYYY-MM-DD)");
			let fetched = 0;
			const result = await writeTimelines(
				imageOptions,
				season,
				through,
				new Client({
					...imageOptions,
					cacheDir: timelinesDir,
					fetch: (input, init) => {
						if (++fetched % 50 === 1)
							console.error(`Fetching timeline ${fetched}`);
						return fetch(input, init);
					},
				}),
			);
			console.log(`${result.games} games`, result.counts);
		} else if (positionals[0] === "internationals") {
			const season = await snapshotSeason(outputDir);
			const result = await internationals(
				{
					...imageOptions,
					fetch: (input, init) => {
						console.error(
							`Fetching ${new URL(String(input)).searchParams.get("tables")}`,
						);
						return fetch(input, init);
					},
				},
				season,
			);
			console.log(
				`${result.matches} series in ${result.events.join(", ")} (${season})`,
			);
		} else if (positionals[0] === "leagues") {
			const result = await writeLeagueLogos(imageOptions);
			console.log(`${result.logos} of ${result.total} league logos`);
			for (const miss of result.unmatched)
				console.log(`unmatched ${miss.id}: ${miss.reason}`);
		} else if (positionals[0] === "logos") {
			const result = await writeLogos(imageOptions);
			console.log(`${result.logos} of ${result.teams.length} logos`);
			for (const miss of result.unmatched)
				console.log(`unmatched ${miss.league} ${miss.team}: ${miss.reason}`);
		} else {
			const options = {
				cacheDir,
				outputDir,
				offline: values.offline,
				maxAttempts: Number(values["max-attempts"] ?? "5"),
				fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
					const url = new URL(String(input));
					const table = url.searchParams.get("tables");
					const label = table
						? `${table} (offset ${url.searchParams.get("offset")})`
						: (url.searchParams.get("prop") ?? url.hostname);
					console.error(`Fetching ${label}`);
					return fetch(input, init);
				},
			};
			const client = new Client(options);
			const result = await snapshot(
				options,
				client,
				client.withCache(historyDir),
			);
			const career = await history(
				{ ...options, cacheDir: historyDir },
				client.withCache(historyDir),
			);
			console.error(
				`Career history: ${career.players} players, seasons ${career.years[0]}-${career.years.at(-1)}`,
			);
			const countries = await nationalities(
				options,
				client.withCache(options.cacheDir),
			);
			console.error(
				`Nationalities: ${countries.players} players${countries.unmapped.length ? `, unmapped: ${countries.unmapped.join(", ")}` : ""}`,
			);
			console.table(result.totals);
			console.log(JSON.stringify({ bytes: result.bytes, ...result.oddities }));
		}
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
