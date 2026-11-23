import type { ChampionCatalog } from "@rift-legends/contracts";
import { expect, test, vi } from "vitest";
import { createAssetsApi } from "../../preload/assets";
import { registerAssetIpc } from "./ipc";

test("validates the sender and rejects any arguments before handling asset IPC", async () => {
	const mainFrame = {};
	const handlers = new Map<
		string,
		(event: { senderFrame: unknown }, ...args: unknown[]) => unknown
	>();
	const window = {
		webContents: { mainFrame, send: vi.fn() },
		once: vi.fn(),
	};
	const ipc = {
		handle: (
			channel: string,
			handler: NonNullable<ReturnType<typeof handlers.get>>,
		) => handlers.set(channel, handler),
		removeHandler: (channel: string) => handlers.delete(channel),
	};
	const cache = {
		getChampions: vi.fn(
			(): ChampionCatalog => [
				{
					id: "MonkeyKing",
					key: 62,
					names: { es: "Wukong", en: "Wukong" },
					titles: { es: "El Rey Mono", en: "The Monkey King" },
					classes: ["fighter"],
				},
			],
		),
		syncTeamLogos: vi.fn(async () => ({ failed: [] })),
		getTeamLogos: vi.fn(async () => ({
			"Gen.G": "rift-asset://logos/teams/gen-g.png",
		})),
		getPlayerPhotos: vi.fn(async () => ({
			mid: "rift-asset://photos/players/mid.png",
		})),
		getStatus: vi.fn(() => ({ state: "missing" as const })),
		sync: vi.fn(async () => ({ state: "missing" as const })),
		subscribe: vi.fn(() => () => {}),
		subscribeTeamLogos: vi.fn(() => () => {}),
		subscribePlayerPhotos: vi.fn(() => () => {}),
	};
	registerAssetIpc(window as never, ipc as never, cache);
	for (const channel of [
		"assets:status",
		"assets:sync",
		"assets:champions",
		"assets:teamLogos",
		"assets:playerPhotos",
	]) {
		const handle = handlers.get(channel);
		expect(handle).toBeDefined();
		expect(() => handle?.({ senderFrame: {} })).toThrow(
			"requires the main frame",
		);
		expect(() => handle?.({ senderFrame: mainFrame }, undefined)).toThrow(
			"takes no arguments",
		);
		expect(() =>
			handle?.({ senderFrame: mainFrame }, { path: "ignored" }),
		).toThrow("takes no arguments");
	}
	expect(cache.getStatus).not.toHaveBeenCalled();
	expect(cache.sync).not.toHaveBeenCalled();
	expect(cache.getChampions).not.toHaveBeenCalled();
	await expect(
		handlers.get("assets:sync")?.({ senderFrame: mainFrame }),
	).resolves.toEqual({
		state: "missing",
	});
	const bridge = createAssetsApi({
		invoke: async (channel, ...args) =>
			handlers.get(channel)?.({ senderFrame: mainFrame }, ...args),
		on: vi.fn(),
		off: vi.fn(),
	});
	await expect(bridge.teamLogos()).resolves.toEqual({
		"Gen.G": "rift-asset://logos/teams/gen-g.png",
	});
	await expect(bridge.playerPhotos()).resolves.toEqual({
		mid: "rift-asset://photos/players/mid.png",
	});
	await expect(bridge.champions()).resolves.toEqual(cache.getChampions());
});
