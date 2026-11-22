import type {
	AssetProgress,
	AssetStatus,
	ChampionCatalog,
} from "@rift-legends/contracts";
import { vi } from "vitest";
import type { AssetsApi } from "../src/shared/bridge";

/** An in-memory asset bridge: no network, every answer under the test's control. */
export function fakeAssets(
	initial: AssetStatus = { state: "missing" },
	catalog: ChampionCatalog | null = null,
) {
	let current = initial;
	let finish: ((status: AssetStatus) => void) | undefined;
	const listeners = new Set<(progress: AssetProgress) => void>();
	const unsubscribe = vi.fn();
	const api = {
		status: vi.fn(async () => current),
		champions: vi.fn(async () => catalog),
		teamLogos: vi.fn(async (): Promise<Record<string, string>> => ({})),
		sync: vi.fn(() => {
			current = { state: "syncing", progress: { completed: 0, total: 0 } };
			return new Promise<AssetStatus>((resolve) => {
				finish = resolve;
			});
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
