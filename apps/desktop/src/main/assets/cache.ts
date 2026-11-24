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
		subscribePlayerPhotos: optional.subscribePlayerPhotos,
		getStatus: (): CacheStatus => status,
		getChampions: (): ChampionCatalog | null => champions,
		subscribe(listener: (progress: AssetProgress) => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		sync(startup = false): Promise<CacheStatus> {
			if (running) return running;
			running = synchronizeCatalog({
				userData,
				transport,
				startup,
				setChampions: (catalog) => {
					champions = catalog;
				},
				reportProgress,
			})
				.catch(
					(error): CacheStatus => ({
						state: "error",
						reason:
							error instanceof Error
								? error.message
								: "Asset synchronization failed",
					}),
				)
				.then((result) => {
					// Optional assets must not delay a playable champion catalog.
					if (result.state === "ready") optional.startSyncs();
					status = result;
					running = undefined;
					return result;
				});
			reportProgress({ completed: 0, total: 0 });
			return running;
		},
	};
}
