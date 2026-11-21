import { dirname } from "node:path";
import { communityFiles, isVersion, versionsUrl } from "./catalog";
import { cachePath } from "./disk";
import {
	activateVersion,
	activeVersion,
	prepareVersion,
	pruneVersions,
	verifiesVersion,
} from "./store";
import {
	type AssetTransport,
	httpsTransport,
	NetworkUnavailable,
	responseLength,
	withResponse,
} from "./transport";

type AssetStatus =
	| { state: "missing" }
	| { state: "syncing"; progress: { completed: number; total: number } }
	| { state: "ready"; version: string }
	| { state: "error"; reason: string };

function newer(version: string, current: string): boolean {
	return version.localeCompare(current, "en", { numeric: true }) > 0;
}

async function latestVersion(transport: AssetTransport): Promise<string> {
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
			if (!Array.isArray(versions) || !isVersion(versions[0]))
				throw new Error("Invalid Data Dragon version");
			return versions[0];
		},
	);
}

export function createAssetCache(
	userData: string,
	{ transport = httpsTransport }: { transport?: AssetTransport } = {},
) {
	let status: AssetStatus = { state: "missing" };
	let running: Promise<AssetStatus> | undefined;

	async function synchronize(): Promise<AssetStatus> {
		let fallback: AssetStatus = { state: "missing" };
		try {
			const ddragon = dirname(
				await cachePath(userData, "assets/ddragon/current.json", true),
			);
			const cdragon = dirname(
				await cachePath(userData, "assets/cdragon/current.json", true),
			);
			const dataVersion = await activeVersion(ddragon, "ddragon");
			const iconVersion = await activeVersion(cdragon, "cdragon");
			// The Data Dragon pointer commits the pair. If only the icon pointer
			// advanced before a shutdown, the previous verified icons are still on disk.
			if (
				dataVersion &&
				iconVersion &&
				(dataVersion === iconVersion ||
					(newer(iconVersion, dataVersion) &&
						(await verifiesVersion(cdragon, "cdragon", dataVersion))))
			) {
				fallback = { state: "ready", version: dataVersion };
			}

			const version = await latestVersion(transport);
			if (fallback.state === "ready" && !newer(version, fallback.version)) {
				return fallback;
			}

			let dataDone = 0;
			const sources = [
				{ root: ddragon, source: "ddragon", active: dataVersion },
				{ root: cdragon, source: "cdragon", active: iconVersion },
			] as const;
			for (const { root, source, active } of sources) {
				if (active === version) continue;
				let sourceDone = 0;
				const pendingIcons =
					source === "ddragon" && iconVersion !== version
						? communityFiles.length
						: 0;
				await prepareVersion(
					root,
					source,
					version,
					transport,
					(completed, total) => {
						sourceDone = completed;
						status = {
							state: "syncing",
							progress: {
								completed: dataDone + completed,
								total: dataDone + total + pendingIcons,
							},
						};
					},
				);
				dataDone += sourceDone;
			}
			if (iconVersion !== version) await activateVersion(cdragon, version);
			if (dataVersion !== version) await activateVersion(ddragon, version);
			await Promise.all(
				sources.map(({ root }) =>
					pruneVersions(root, version).catch(() => undefined),
				),
			);
			return { state: "ready", version };
		} catch (error) {
			if (error instanceof NetworkUnavailable) return fallback;
			const reason =
				error instanceof Error ? error.message : "Asset synchronization failed";
			return { state: "error", reason };
		}
	}

	return {
		getStatus: (): AssetStatus => status,
		sync(): Promise<AssetStatus> {
			if (running) return running;
			status = { state: "syncing", progress: { completed: 0, total: 0 } };
			running = synchronize().then((result) => {
				status = result;
				running = undefined;
				return result;
			});
			return running;
		},
	};
}
