import { dirname } from "node:path";
import type {
	AssetProgress,
	AssetStatus,
	ChampionCatalog,
} from "@rift-legends/contracts";
import { realPhotoSchema } from "@rift-legends/contracts/real-photos";
import { isVersion, versionsUrl } from "./catalog";
import { cachePath } from "./disk";
import {
	readLeagueLogos,
	readTeamLogos,
	syncLeagueLogos,
	syncTeamLogos,
	type TeamLogoSource,
} from "./logos";
import { readPlayerPhotos, syncPlayerPhotos } from "./photos";
import {
	activateVersion,
	activeCatalog,
	prepareVersion,
	pruneVersions,
} from "./store";
import { acquireSyncLock } from "./sync-lock";
import {
	type AssetTransport,
	httpsTransport,
	NetworkUnavailable,
	responseLength,
	withResponse,
} from "./transport";

type CacheStatus =
	| Exclude<AssetStatus, { state: "error" }>
	| { state: "error"; reason: string };

function newer(version: string, current: string): boolean {
	return version.localeCompare(current, "en", { numeric: true }) > 0;
}

async function candidatePatches(transport: AssetTransport): Promise<string[]> {
	return withResponse(
		transport,
		versionsUrl,
		{},
		async ({ status, headers, body }) => {
			if (status !== 200)
				throw new Error(`Version lookup failed (HTTP ${status})`);
			const limit = 64 * 1024;
			const expected = responseLength(headers["content-length"]);
			if (expected !== undefined && expected > limit)
				throw new Error("Version list exceeds size limit");
			const chunks: Uint8Array[] = [];
			let size = 0;
			for await (const chunk of body) {
				size += chunk.length;
				if (size > (expected ?? limit))
					throw new Error("Version list exceeds size limit");
				chunks.push(chunk);
			}
			if (expected !== undefined && size !== expected)
				throw new Error("Incomplete version list");
			const versions: unknown = JSON.parse(
				Buffer.concat(chunks).toString("utf8"),
			);
			if (!Array.isArray(versions) || !versions.length)
				throw new Error("Invalid Data Dragon version list");
			const patches = new Set<string>();
			for (const version of versions) {
				if (
					typeof version !== "string" ||
					!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)
				)
					throw new Error("Invalid Data Dragon version");
				const patch = version.slice(0, version.lastIndexOf("."));
				if (!isVersion(patch)) throw new Error("Invalid CommunityDragon patch");
				patches.add(patch);
				if (patches.size === 2) break;
			}
			return [...patches];
		},
	);
}

export function createAssetCache(
	userData: string,
	{
		transport = httpsTransport,
		logos = [],
		photos = [],
		leagueLogos = [],
	}: {
		transport?: AssetTransport;
		logos?: readonly (Omit<TeamLogoSource, "id"> & { team: string })[];
		photos?: readonly unknown[];
		leagueLogos?: readonly TeamLogoSource[];
	} = {},
) {
	let status: CacheStatus = { state: "missing" };
	let champions: ChampionCatalog | null = null;
	let running: Promise<CacheStatus> | undefined;
	let syncingLogos: Promise<void> | undefined;
	let syncingPhotos: Promise<void> | undefined;
	let syncingLeagueLogos: Promise<void> | undefined;
	const listeners = new Set<(progress: AssetProgress) => void>();
	const logoListeners = new Set<() => void>();
	const photoListeners = new Set<() => void>();

	function reportProgress(progress: AssetProgress) {
		status = { state: "syncing", progress };
		for (const listener of listeners) listener(progress);
	}

	async function synchronize(): Promise<CacheStatus> {
		let fallback: CacheStatus = { state: "missing" };
		let release: (() => Promise<void>) | undefined;
		try {
			const root = dirname(
				await cachePath(userData, "assets/cdragon/current.json", true),
			);
			release = await acquireSyncLock(dirname(root));
			const active = await activeCatalog(root);
			champions = active?.catalog ?? null;
			if (active) fallback = { state: "ready", version: active.version };

			for (const version of await candidatePatches(transport)) {
				// A cache made before tiles is fetched again on its own patch.
				const refresh = active && !active.tiles && version === active.version;
				if (active && !newer(version, active.version) && !refresh)
					return fallback;
				const catalog = await prepareVersion(
					root,
					version,
					transport,
					(completed, total) => reportProgress({ completed, total }),
				);
				// Both summaries must exist on the same numbered patch.
				if (!catalog) continue;
				await activateVersion(root, version);
				champions = catalog;
				await pruneVersions(root, version).catch(() => undefined);
				return { state: "ready", version };
			}
			if (active) return fallback;
			throw new Error("CommunityDragon champion patch unavailable");
		} catch (error) {
			if (error instanceof NetworkUnavailable) return fallback;
			throw error;
		} finally {
			await release?.();
		}
	}

	const logoRoot = async () =>
		dirname(await cachePath(userData, "assets/logos/manifest.json", true));

	const leagueLogoRoot = async () =>
		dirname(await cachePath(userData, "assets/leagues/manifest.json", true));

	const photoRoot = async () =>
		dirname(await cachePath(userData, "assets/photos/manifest.json", true));

	/** Untrusted snapshot rows; an id listed twice is skipped altogether. */
	async function syncPhotos(): Promise<void> {
		const sources = photos.flatMap((photo) => {
			const parsed = realPhotoSchema.safeParse(photo);
			if (!parsed.success) return [];
			const { player, ...source } = parsed.data;
			return [{ id: player, ...source }];
		});
		const counts = new Map<string, number>();
		for (const { id } of sources) counts.set(id, (counts.get(id) ?? 0) + 1);
		const root = await photoRoot();
		const release = await acquireSyncLock(root);
		try {
			await syncPlayerPhotos(
				root,
				sources.filter(({ id }) => counts.get(id) === 1),
				transport,
			);
		} finally {
			await release();
			for (const listener of photoListeners) listener();
		}
	}

	const cache = {
		/** Photos of the snapshot (untrusted input); failures are per photo. */
		syncPlayerPhotos: syncPhotos,
		/** Logos of the given teams (untrusted snapshot input); failures are per logo. */
		async syncTeamLogos(
			sources: readonly TeamLogoSource[],
		): Promise<{ failed: string[] }> {
			const root = await logoRoot();
			const release = await acquireSyncLock(dirname(root));
			try {
				return await syncTeamLogos(root, sources, transport);
			} finally {
				await release();
				// The renderer read the map when the cache turned ready, before this ran.
				for (const listener of logoListeners) listener();
			}
		},
		/** Team id to `rift-asset://` URL of every verified logo on disk. */
		async getTeamLogos(): Promise<Record<string, string>> {
			await syncingLogos;
			const logos = await readTeamLogos(await logoRoot());
			return Object.fromEntries(
				Object.entries(logos).map(([id, path]) => [
					id,
					`rift-asset://logos/${path}`,
				]),
			);
		},
		/** League logos (untrusted snapshot input); failures are per logo. */
		async syncLeagueLogos(
			sources: readonly TeamLogoSource[],
		): Promise<{ failed: string[] }> {
			const root = await leagueLogoRoot();
			const release = await acquireSyncLock(root);
			try {
				return await syncLeagueLogos(root, sources, transport);
			} finally {
				await release();
				for (const listener of logoListeners) listener();
			}
		},
		/** League or event id to `rift-asset://` URL of every verified logo. */
		async getLeagueLogos(): Promise<Record<string, string>> {
			await syncingLeagueLogos;
			const paths = await readLeagueLogos(await leagueLogoRoot());
			return Object.fromEntries(
				Object.entries(paths).map(([id, path]) => [
					id,
					`rift-asset://leagues/${path}`,
				]),
			);
		},
		/** Notifies when team or league logos land. */
		subscribeTeamLogos(listener: () => void): () => void {
			logoListeners.add(listener);
			return () => logoListeners.delete(listener);
		},
		/** Player id to `rift-asset://` URL of every verified photo on disk. */
		async getPlayerPhotos(): Promise<Record<string, string>> {
			await syncingPhotos;
			const paths = await readPlayerPhotos(await photoRoot());
			return Object.fromEntries(
				Object.entries(paths).map(([id, path]) => [
					id,
					`rift-asset://photos/${path}`,
				]),
			);
		},
		subscribePlayerPhotos(listener: () => void): () => void {
			photoListeners.add(listener);
			return () => photoListeners.delete(listener);
		},
		getStatus: (): CacheStatus => status,
		getChampions: (): ChampionCatalog | null => champions,
		subscribe(listener: (progress: AssetProgress) => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		sync(): Promise<CacheStatus> {
			if (running) return running;
			running = synchronize()
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
					// Optional logos must not delay a playable champion catalog.
					if (result.state === "ready" && logos.length && !syncingLogos) {
						const sources = logos.map(({ team, ...source }) => ({
							...source,
							id: team,
						}));
						syncingLogos = cache
							.syncTeamLogos(sources)
							.then(
								() => undefined,
								() => undefined,
							)
							.finally(() => {
								syncingLogos = undefined;
							});
					}
					if (
						result.state === "ready" &&
						leagueLogos.length &&
						!syncingLeagueLogos
					) {
						syncingLeagueLogos = cache
							.syncLeagueLogos(leagueLogos)
							.then(
								() => undefined,
								() => undefined,
							)
							.finally(() => {
								syncingLeagueLogos = undefined;
							});
					}
					// Same for the photos: read again when they land.
					if (result.state === "ready" && photos.length && !syncingPhotos) {
						syncingPhotos = cache
							.syncPlayerPhotos()
							.catch(() => undefined)
							.finally(() => {
								syncingPhotos = undefined;
							});
					}
					status = result;
					running = undefined;
					return result;
				});
			reportProgress({ completed: 0, total: 0 });
			return running;
		},
	};
	return cache;
}
