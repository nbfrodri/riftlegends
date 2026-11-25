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
	/** Official sounds missing on disk (#555): holds the startup gate too. */
	soundsMissing?: boolean;
	/** Called as soon as the installed or the new catalog is known. */
	setChampions: (catalog: ChampionCatalog | null) => void;
	reportProgress: (progress: AssetProgress) => void;
};

/** Brings the champion catalog up to the newest complete patch. */
export async function synchronizeCatalog({
	userData,
	transport,
	startup,
	soundsMissing = false,
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
		// A cache made before tiles or splashes (#367, #494) lacks art the app uses.
		const artMissing = !!active && (!active.tiles || !active.splashes);
		// While anything is missing the loading screen waits (#555); otherwise
		// the installed catalog opens the app during the background update check.
		const gate = (): Partial<AssetProgress> =>
			!startup || !active
				? {}
				: artMissing || soundsMissing
					? { incomplete: true }
					: { cachedVersion: active.version };
		if (active) {
			fallback = {
				state: "ready",
				version: active.version,
				...(artMissing && { incomplete: true as const }),
			};
			if (startup) reportProgress({ completed: 0, total: 0, ...gate() });
		}

		const candidates = await candidatePatches(transport);
		// An incomplete cache is completed even if its patch is no longer offered.
		if (active && artMissing && !candidates.includes(active.version))
			candidates.push(active.version);
		for (const version of candidates) {
			const refresh = artMissing && version === active?.version;
			if (active && !newer(version, active.version) && !refresh) continue;
			const catalog = await prepareVersion(
				root,
				version,
				transport,
				(completed, total) => reportProgress({ completed, total, ...gate() }),
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
