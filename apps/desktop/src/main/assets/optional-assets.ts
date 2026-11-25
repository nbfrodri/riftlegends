import { dirname } from "node:path";
import { realPhotoSchema } from "@rift-legends/contracts/real-photos";
import { cachePath } from "./disk";
import {
	readLeagueLogos,
	readTeamLogos,
	syncLeagueLogos,
	syncTeamLogos,
	type TeamLogoSource,
} from "./logos";
import { readPlayerPhotos, syncPlayerPhotos } from "./photos";
import { readSounds, type SoundSource, syncSounds } from "./sounds";
import { acquireSyncLock } from "./sync-lock";
import type { AssetTransport } from "./transport";

export type OptionalAssetSources = {
	logos?: readonly (Omit<TeamLogoSource, "id"> & { team: string })[];
	photos?: readonly unknown[];
	leagueLogos?: readonly TeamLogoSource[];
	/** Official draft sounds (#472); main passes `championSelectSounds`. */
	sounds?: readonly SoundSource[];
};

const toUrls = (paths: Record<string, string>, scheme: string) =>
	Object.fromEntries(
		Object.entries(paths).map(([id, path]) => [
			id,
			`rift-asset://${scheme}/${path}`,
		]),
	);

/** Team and league logos and player photos: optional, never block the catalog. */
export function createOptionalAssets(
	userData: string,
	transport: AssetTransport,
	{
		logos = [],
		photos = [],
		leagueLogos = [],
		sounds = [],
	}: OptionalAssetSources,
) {
	let syncingLogos: Promise<void> | undefined;
	let syncingPhotos: Promise<void> | undefined;
	let syncingLeagueLogos: Promise<void> | undefined;
	let syncingSounds: Promise<void> | undefined;
	const logoListeners = new Set<() => void>();
	const photoListeners = new Set<() => void>();

	const logoRoot = async () =>
		dirname(await cachePath(userData, "assets/logos/manifest.json", true));

	const leagueLogoRoot = async () =>
		dirname(await cachePath(userData, "assets/leagues/manifest.json", true));

	const soundRoot = async () =>
		dirname(await cachePath(userData, "assets/sounds/manifest.json", true));

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

	const assets = {
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
			return toUrls(await readTeamLogos(await logoRoot()), "logos");
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
			return toUrls(await readLeagueLogos(await leagueLogoRoot()), "leagues");
		},
		/** Notifies when team or league logos land. */
		subscribeTeamLogos(listener: () => void): () => void {
			logoListeners.add(listener);
			return () => logoListeners.delete(listener);
		},
		/** Player id to `rift-asset://` URL of every verified photo on disk. */
		async getPlayerPhotos(): Promise<Record<string, string>> {
			await syncingPhotos;
			return toUrls(await readPlayerPhotos(await photoRoot()), "photos");
		},
		subscribePlayerPhotos(listener: () => void): () => void {
			photoListeners.add(listener);
			return () => photoListeners.delete(listener);
		},
		/** Official sounds; failures are per sound and leave the fallback. */
		async syncSounds(): Promise<void> {
			const root = await soundRoot();
			const release = await acquireSyncLock(root);
			try {
				await syncSounds(root, sounds, transport);
			} finally {
				await release();
			}
		},
		/** The verified sound bytes on disk, by sound id. */
		async getSounds() {
			await syncingSounds;
			return readSounds(await soundRoot(), sounds);
		},
		/** Starts the configured downloads once the champion catalog is ready. */
		startSyncs(): void {
			if (logos.length && !syncingLogos) {
				const sources = logos.map(({ team, ...source }) => ({
					...source,
					id: team,
				}));
				syncingLogos = assets
					.syncTeamLogos(sources)
					.then(
						() => undefined,
						() => undefined,
					)
					.finally(() => {
						syncingLogos = undefined;
					});
			}
			if (leagueLogos.length && !syncingLeagueLogos) {
				syncingLeagueLogos = assets
					.syncLeagueLogos(leagueLogos)
					.then(
						() => undefined,
						() => undefined,
					)
					.finally(() => {
						syncingLeagueLogos = undefined;
					});
			}
			if (sounds.length && !syncingSounds) {
				syncingSounds = assets
					.syncSounds()
					.catch(() => undefined)
					.finally(() => {
						syncingSounds = undefined;
					});
			}
			// Same for the photos: read again when they land.
			if (photos.length && !syncingPhotos) {
				syncingPhotos = assets
					.syncPlayerPhotos()
					.catch(() => undefined)
					.finally(() => {
						syncingPhotos = undefined;
					});
			}
		},
	};
	return assets;
}
