import { dirname } from "node:path";
import type {
	AssetProgress,
	AssetStatus,
	ChampionCatalog,
} from "@rift-legends/contracts";
import { isVersion, versionsUrl } from "./catalog";
import { cachePath } from "./disk";
import { readTeamLogos, syncTeamLogos, type TeamLogoSource } from "./logos";
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
	{ transport = httpsTransport }: { transport?: AssetTransport } = {},
) {
	let status: CacheStatus = { state: "missing" };
	let champions: ChampionCatalog | null = null;
	let running: Promise<CacheStatus> | undefined;
	const listeners = new Set<(progress: AssetProgress) => void>();

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
				if (active && !newer(version, active.version)) return fallback;
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

	return {
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
			}
		},
		/** Team id to `rift-asset://` URL of every verified logo on disk. */
		async getTeamLogos(): Promise<Record<string, string>> {
			const logos = await readTeamLogos(await logoRoot());
			return Object.fromEntries(
				Object.entries(logos).map(([id, path]) => [
					id,
					`rift-asset://logos/${path}`,
				]),
			);
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
					status = result;
					running = undefined;
					return result;
				});
			reportProgress({ completed: 0, total: 0 });
			return running;
		},
	};
}
