import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { createAssetCache } from "./cache";
import type { AssetTransport } from "./transport";

export const versions = "/api/versions.json";
export const gameData = "plugins/rcp-be-lol-game-data/global";
export const summary = (patch: string, locale: string) =>
	`/${patch}/${gameData}/${locale}/v1/champion-summary.json`;
export const portrait = `/16.23/${gameData}/default/v1/champion-icons/103.png`;
export const postgame = "plugins/rcp-fe-lol-postgame/global/default";
export const statIcons = {
	kda: `${postgame}/scoreboard-kda-icon.svg`,
	gold: `${postgame}/scoreboard-coins-icon.svg`,
	cs: `${postgame}/scoreboard-stat-switcher-minions-slain.svg`,
	damage: `${postgame}/scoreboard-sword-icon.svg`,
	vision: `${postgame}/scoreboard-stat-switcher-eye.svg`,
};
export const svg = (label: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>${label}</title></svg>`;
export const champion = {
	id: 103,
	alias: "Ahri",
	name: "Ahri",
	description: "The Nine-Tailed Fox",
	roles: ["mage", "assassin"],
	squarePortraitPath: "/lol-game-data/assets/v1/champion-icons/103.png",
};
export const png = Buffer.from("89504e470d0a1a0a0102030405060708", "hex");
export const jpeg = Buffer.from("ffd8ffe000104a464946000101000001", "hex");
export const championData = `/16.23/${gameData}/default/v1/champions/103.json`;
export const tile = `/16.23/${gameData}/default/assets/characters/ahri/skins/base/images/ahri_splash_tile_0.jpg`;
export const ahriData = (tilePath: unknown) =>
	JSON.stringify({
		id: 103,
		alias: "Ahri",
		skins: [{ id: 103000, isBase: true, tilePath }],
	});
export const ahriTile =
	"/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Base/Images/ahri_splash_tile_0.jpg";
export const etag = '"assets-1"';

export function response(
	bytes: Buffer | string,
	status = 200,
	headers: Record<string, string> = {},
) {
	const buffer = Buffer.from(bytes);
	return {
		status,
		headers: { "content-length": String(buffer.length), etag, ...headers },
		body: (async function* () {
			yield buffer;
		})(),
	};
}

export function networkError(code: string) {
	return Object.assign(new Error(code), { code });
}

/** In-memory CommunityDragon plus a temporary profile for the cache tests. */
type CacheFixture = {
	profile: string;
	version: string;
	catalog: unknown[];
	versionsList: string[];
	requests: Array<{ url: URL; headers: Record<string, string> }>;
	override: AssetTransport | undefined;
	transport: AssetTransport;
	create: () => ReturnType<typeof createAssetCache>;
	source: (...parts: string[]) => string;
};

export function useCacheFixture(): CacheFixture {
	const fixture: CacheFixture = {
		profile: "",
		version: "16.23",
		catalog: [],
		versionsList: [],
		requests: [],
		override: undefined,
		transport: async (url, headers, signal) => {
			fixture.requests.push({ url, headers });
			const special = await fixture.override?.(url, headers, signal);
			if (special) return special;
			if (url.pathname === versions)
				return response(JSON.stringify(fixture.versionsList));
			if (url.pathname.endsWith("champion-summary.json")) {
				const entries = url.pathname.includes("/es_es/")
					? fixture.catalog.map((entry) =>
							entry === champion
								? { ...champion, description: "La Mujer Zorro" }
								: entry,
						)
					: fixture.catalog;
				return response(JSON.stringify(entries));
			}
			if (url.pathname.endsWith(".svg")) return response(svg("icon"));
			if (url.pathname.endsWith("/v1/champions/103.json"))
				return response(ahriData(ahriTile));
			if (url.pathname.endsWith(".jpg")) return response(jpeg);
			return response(png);
		},
		create: () =>
			createAssetCache(fixture.profile, { transport: fixture.transport }),
		source: (...parts: string[]) =>
			join(fixture.profile, "assets", "cdragon", ...parts),
	};

	beforeEach(async () => {
		fixture.profile = await mkdtemp(join(tmpdir(), "rift-assets-"));
		fixture.version = "16.23";
		fixture.versionsList = ["16.23.1", "16.22.1"];
		fixture.catalog = [
			{ id: -1, alias: "None", roles: [] },
			champion,
			{ id: 60001, alias: "Jade_Annie", roles: ["mage"] },
			{ id: 104, alias: "Placeholder", roles: [] },
		];
		fixture.requests = [];
		fixture.override = undefined;
	});
	afterEach(async () => {
		await rm(fixture.profile, { recursive: true, force: true });
	});
	return fixture;
}
