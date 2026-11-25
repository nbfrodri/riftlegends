import type {
	AssetProgress,
	AssetStatus,
	ChampionCatalog,
} from "@rift-legends/contracts";
import { vi } from "vitest";
import type { AssetsApi } from "../src/shared/bridge";
import type { CachedSounds } from "../src/shared/sounds";

/** An in-memory asset bridge: no network, every answer under the test's control. */
export function fakeAssets(
	initial: AssetStatus = { state: "missing" },
	catalog: ChampionCatalog | null = null,
) {
	let current = initial;
	let finish: ((status: AssetStatus) => void) | undefined;
	const listeners = new Set<(progress: AssetProgress) => void>();
	const logoListeners = new Set<() => void>();
	const photoListeners = new Set<() => void>();
	const unsubscribe = vi.fn();
	const api = {
		status: vi.fn(async () => current),
		champions: vi.fn(async () => catalog),
		teamLogos: vi.fn(async (): Promise<Record<string, string>> => ({})),
		playerPhotos: vi.fn(async (): Promise<Record<string, string>> => ({})),
		leagueLogos: vi.fn(async (): Promise<Record<string, string>> => ({})),
		sounds: vi.fn(async (): Promise<CachedSounds> => ({})),
		sync: vi.fn(() => {
			current = { state: "syncing", progress: { completed: 0, total: 0 } };
			return new Promise<AssetStatus>((resolve) => {
				finish = resolve;
			});
		}),
		subscribePlayerPhotos: vi.fn((listener: () => void) => {
			photoListeners.add(listener);
			return () => {
				photoListeners.delete(listener);
			};
		}),
		subscribeTeamLogos: vi.fn((listener: () => void) => {
			logoListeners.add(listener);
			return () => {
				logoListeners.delete(listener);
			};
		}),
		subscribe: vi.fn((listener: (progress: AssetProgress) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				unsubscribe();
			};
		}),
	} satisfies AssetsApi;
	return {
		api,
		unsubscribe,
		/** Sends a progress event, as main does while syncing. */
		progress(progress: AssetProgress) {
			current = { state: "syncing", progress };
			for (const listener of [...listeners]) listener(progress);
		},
		/** Tells the renderer that main finished downloading team logos. */
		logosChanged() {
			for (const listener of [...logoListeners]) listener();
		},
		/** Tells the renderer that main finished downloading player photos. */
		photosChanged() {
			for (const listener of [...photoListeners]) listener();
		},
		/** Ends the pending `sync()` call with `status`. */
		finish(status: AssetStatus) {
			current = status;
			finish?.(status);
		},
	};
}

/** A catalog for `ids` with made-up names that say their language. */
export function testCatalog(ids: readonly string[]): ChampionCatalog {
	return ids.map((id, index) => ({
		id,
		key: index + 1,
		classes: ["fighter"],
		names: { es: `${id} ES`, en: `${id} EN` },
		titles: { es: "título", en: "title" },
	}));
}
