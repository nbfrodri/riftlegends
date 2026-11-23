import { type Client, OfflineCacheMiss } from "./client.ts";
import {
	bin,
	type ChampionKit,
	readKit,
	readTooltips,
	stringtableUrl,
	tooltipsBody,
} from "./champion-kit-source.ts";

/**
 * Downloads the kit of each champion (#340). A champion whose file is missing
 * (new or renamed in the game data) or not cached offline is reported in
 * `missing` and keeps its estimates; any other failure stops the run.
 */
export async function fetchKits(
	client: Client,
	patch: string,
	ids: readonly string[],
) {
	const kits = new Map<string, ChampionKit>();
	const url = stringtableUrl(patch);
	let tooltips: Record<string, string>;
	try {
		tooltips = await client.get(url, readTooltips, tooltipsBody);
	} catch (error) {
		if (error instanceof OfflineCacheMiss)
			return { kits, missing: [...ids], retrievedAt: undefined, url };
		throw error;
	}
	const missing: string[] = [];
	for (const id of ids) {
		try {
			kits.set(
				id,
				await client.get(bin(patch, id), (body) =>
					readKit(id, body, tooltips),
				),
			);
		} catch (error) {
			const absent =
				error instanceof OfflineCacheMiss ||
				(error instanceof Error && /\(HTTP 404\)/.test(error.message));
			if (!absent) throw error;
			missing.push(id);
		}
	}
	return { kits, missing, retrievedAt: client.queries.get(url), url };
}
