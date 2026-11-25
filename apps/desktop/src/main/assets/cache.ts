import type { AssetProgress, ChampionCatalog } from "@rift-legends/contracts";
import { type CacheStatus, synchronizeCatalog } from "./catalog-sync";
import {
	createOptionalAssets,
	type OptionalAssetSources,
} from "./optional-assets";
import { type AssetTransport, httpsTransport } from "./transport";

export function createAssetCache(
	userData: string,
	{
		transport = httpsTransport,
		...sources
	}: { transport?: AssetTransport } & OptionalAssetSources = {},
) {
	let status: CacheStatus = { state: "missing" };
	let champions: ChampionCatalog | null = null;
	let running: Promise<CacheStatus> | undefined;
	const listeners = new Set<(progress: AssetProgress) => void>();
	const optional = createOptionalAssets(userData, transport, sources);

	function reportProgress(progress: AssetProgress) {
		status = { state: "syncing", progress };
		for (const listener of listeners) listener(progress);
	}

	return {
		syncPlayerPhotos: optional.syncPlayerPhotos,
		syncTeamLogos: optional.syncTeamLogos,
		getTeamLogos: optional.getTeamLogos,
		syncLeagueLogos: optional.syncLeagueLogos,
		getLeagueLogos: optional.getLeagueLogos,
		subscribeTeamLogos: optional.subscribeTeamLogos,
		getPlayerPhotos: optional.getPlayerPhotos,
		syncSounds: optional.syncSounds,
		getSounds: optional.getSounds,
		subscribePlayerPhotos: optional.subscribePlayerPhotos,
		getStatus: (): CacheStatus => status,
		getChampions: (): ChampionCatalog | null => champions,
		subscribe(listener: (progress: AssetProgress) => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		sync(startup = false): Promise<CacheStatus> {
			if (running) return running;
			running = (async (): Promise<CacheStatus> => {
				const soundsMissing = (await optional.missingSounds()) > 0;
				const result = await synchronizeCatalog({
					userData,
					transport,
					startup,
					soundsMissing,
					setChampions: (catalog) => {
						champions = catalog;
					},
					reportProgress,
				}).catch(
					(error): CacheStatus => ({
						state: "error",
						reason:
							error instanceof Error
								? error.message
								: "Asset synchronization failed",
					}),
				);
				if (result.state !== "ready") return result;
				// The official sounds are part of the cache (#555); the other
				// optional assets (logos, photos) are best effort and never wait.
				if (soundsMissing)
					await optional
						.syncSounds((completed, total) =>
							reportProgress({ completed, total, incomplete: true }),
						)
						.catch(() => undefined);
				optional.startSyncs();
				const incomplete =
					result.incomplete || (await optional.missingSounds()) > 0;
				return incomplete
					? { state: "ready", version: result.version, incomplete: true }
					: { state: "ready", version: result.version };
			})().then((result) => {
				status = result;
				running = undefined;
				return result;
			});
			reportProgress({ completed: 0, total: 0 });
			return running;
		},
	};
}
