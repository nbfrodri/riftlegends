import { describe, expect, it } from "vitest";
import { championDataFile, tileFile, tilePath } from "./catalog";

const galio = {
	id: "Galio",
	key: 3,
	name: "Galio",
	title: "the Colossus",
	classes: ["tank" as const],
};
const base = (tilePath: unknown, extra: Record<string, unknown> = {}) => ({
	id: 3,
	alias: "Galio",
	skins: [{ id: 3000, isBase: true, tilePath, ...extra }],
});
const galioTile =
	"/lol-game-data/assets/ASSETS/Characters/Galio/Skins/Base/Images/galio_splash_tile_0.jpg";
const cdragon = "https://raw.communitydragon.org/16.23";
const gameData = "plugins/rcp-be-lol-game-data/global/default";

describe("champion tile art", () => {
	it("reads each champion's data from its numeric key on the same patch", () => {
		const file = championDataFile("16.23", galio);
		expect(file.path).toBe("upstream/champions/3.json");
		expect(file.url.href).toBe(`${cdragon}/${gameData}/v1/champions/3.json`);
		expect(file.limit).toBe(1024 * 1024);
	});

	it.each([
		[
			galioTile,
			`${cdragon}/${gameData}/assets/characters/galio/skins/base/images/galio_splash_tile_0.jpg`,
		],
		// Real upstream variants: lowercase folders, renamed files, Skin0.
		[
			"/lol-game-data/assets/ASSETS/Characters/Galio/skins/base/Images/GalioRework_splash_tile_0.jpg",
			`${cdragon}/${gameData}/assets/characters/galio/skins/base/images/galiorework_splash_tile_0.jpg`,
		],
		[
			"/lol-game-data/assets/ASSETS/Characters/GALIO/Skins/Skin0/Images/galio_splash_tile_0.jpg",
			`${cdragon}/${gameData}/assets/characters/galio/skins/skin0/images/galio_splash_tile_0.jpg`,
		],
	])("accepts the base skin tile %s at its lowercase URL", (path, url) => {
		const file = tileFile("16.23", galio, base(path));
		expect(file?.url.href).toBe(url);
		expect(file?.path).toBe("tiles/Galio.jpg");
		expect(file?.limit).toBe(1024 * 1024);
	});

	it("checks the downloaded tile is a JPEG", () => {
		const check = tileFile("16.23", galio, base(galioTile))?.check;
		expect(check?.(Buffer.from("ffd8ffe000104a46", "hex"))).toBe(true);
		expect(check?.(Buffer.from("89504e470d0a1a0a", "hex"))).toBe(false);
		expect(check?.(Buffer.from("<svg></svg>"))).toBe(false);
	});

	it("names the local tile after the champion id", () => {
		expect(tilePath(galio)).toBe("tiles/Galio.jpg");
	});

	it.each([
		["another champion's folder", galioTile.replace("/Galio/", "/Ahri/")],
		["another skin", galioTile.replace("tile_0", "tile_1")],
		["a splash instead of a tile", galioTile.replace("tile", "centered")],
		["a PNG", galioTile.replace(".jpg", ".png")],
		["an SVG", galioTile.replace(".jpg", ".svg")],
		["a dot segment", galioTile.replace("/Base/", "/../")],
		["an encoded separator", galioTile.replace("/Base/", "/Base%2f/")],
		["a foreign URL", `https://example.com${galioTile}`],
		["a protocol-relative URL", `//example.com${galioTile}`],
		["a query", `${galioTile}?x`],
		["another plugin", galioTile.replace("lol-game-data", "lol-store")],
		["a non-string path", 42],
		["an oversized path", `${galioTile}${"a".repeat(300)}`],
	])("rejects %s", (_problem, path) => {
		expect(tileFile("16.23", galio, base(path))).toBeUndefined();
	});

	it.each([
		["not an object", null],
		["another champion", { ...base(galioTile), id: 4 }],
		["no skins", { id: 3, alias: "Galio" }],
		["no base skin first", base(galioTile, { isBase: false })],
		["a skin of another champion", base(galioTile, { id: 4000 })],
	])("rejects champion data with %s", (_problem, data) => {
		expect(tileFile("16.23", galio, data)).toBeUndefined();
	});
});
