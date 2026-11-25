import { dirname } from "node:path";
import type {
	AssetProgress,
	AssetStatus,
	ChampionCatalog,
} from "@rift-legends/contracts";
import { cachePath } from "./disk";
import { candidatePatches, newer } from "./patches";
import {
	activateVersion,
	activeCatalog,
	prepareVersion,
	pruneVersions,
} from "./store";
import { acquireSyncLock } from "./sync-lock";
import { type AssetTransport, NetworkUnavailable } from "./transport";

export type CacheStatus =
	| Exclude<AssetStatus, { state: "error" }>
	| { state: "error"; reason: string };

type CatalogSync = {
	userData: string;
	transport: AssetTransport;
	startup: boolean;
	/** Called as soon as the installed or the new catalog is known. */
	setChampions: (catalog: ChampionCatalog | null) => void;
	reportProgress: (progress: AssetProgress) => void;
};

/** Brings the champion catalog up to the newest complete patch. */
export async function synchronizeCatalog({
	userData,
	transport,
	startup,
	setChampions,
	reportProgress,
}: CatalogSync): Promise<CacheStatus> {
	let fallback: CacheStatus = { state: "missing" };
	let release: (() => Promise<void>) | undefined;
	try {
		const root = dirname(
			await cachePath(userData, "assets/cdragon/current.json", true),
		);
		release = await acquireSyncLock(dirname(root));
		const active = await activeCatalog(root);
		setChampions(active?.catalog ?? null);
		if (active) {
			fallback = { state: "ready", version: active.version };
			if (startup)
				reportProgress({
					completed: 0,
					total: 0,
					cachedVersion: active.version,
				});
		}

		for (const version of await candidatePatches(transport)) {
			// A cache made before tiles or splashes is fetched again on its own patch.
			const refresh =
				active &&
				(!active.tiles || !active.splashes) &&
				version === active.version;
			if (active && !newer(version, active.version) && !refresh)
				return fallback;
			const catalog = await prepareVersion(
				root,
				version,
				transport,
				(completed, total) =>
					reportProgress({
						completed,
						total,
						...(startup && active && { cachedVersion: active.version }),
					}),
			);
			// Both summaries must exist on the same numbered patch.
			if (!catalog) continue;
			await activateVersion(root, version);
			setChampions(catalog);
			await pruneVersions(root, version).catch(() => undefined);
			return { state: "ready", version };
		}
		if (active) return fallback;
		throw new Error("CommunityDragon champion patch unavailable");
	} catch (error) {
		if (
			(startup && fallback.state === "ready") ||
			error instanceof NetworkUnavailable
		)
			return fallback;
		throw error;
	} finally {
		await release?.();
	}
}
