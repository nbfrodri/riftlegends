import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Well-known champions across roles with the ranges a player would accept for
// the profile derived from the game data (#340). The ranges start from the old
// curated values (+-2) and are widened only where the data legitimately differs.
type Row = readonly [
	id: string,
	damage: readonly string[],
	cc: readonly [number, number],
	mobility: readonly [number, number],
];
const P = ["physical"];
const M = ["magic"];
const mixed = (...types: string[]) => ["mixed", ...types];
const expected: readonly Row[] = [
	["Aatrox", P, [5, 8], [5, 8]],
	["Jax", mixed("physical"), [3, 8], [5, 9]],
	["Renekton", P, [3, 8], [5, 8]],
	["KSante", mixed("physical"), [7, 10], [6, 10]],
	["Ornn", mixed("magic"), [8, 10], [4, 9]],
	["Rumble", M, [2, 6], [2, 5]],
	["Azir", M, [4, 8], [4, 9]],
	["Orianna", M, [5, 8], [1, 4]],
	["Ahri", M, [2, 7], [7, 10]],
	["Sylas", mixed("magic"), [3, 7], [5, 9]],
	["Syndra", mixed("magic"), [4, 8], [1, 3]],
	["Kaisa", mixed("physical"), [0, 3], [7, 10]],
	["Ezreal", mixed("physical", "magic"), [0, 3], [7, 10]],
	["Varus", mixed("physical"), [5, 9], [1, 4]],
	["Jinx", P, [2, 6], [1, 5]],
	["Xayah", P, [3, 8], [3, 8]],
	["Nautilus", mixed("utility", "magic"), [8, 10], [3, 7]],
	["Rell", mixed("utility", "magic"), [8, 10], [4, 8]],
	["Thresh", ["utility", "magic"], [8, 10], [2, 6]],
	["Lulu", ["utility"], [6, 10], [3, 7]],
	["LeeSin", mixed("physical"), [4, 8], [7, 10]],
	["Vi", P, [6, 10], [6, 10]],
	["Sejuani", mixed("magic"), [8, 10], [3, 7]],
	["Kindred", mixed("physical"), [0, 5], [4, 8]],
	["Zed", P, [0, 3], [6, 10]],
];

const champions = new Map(
	(
		JSON.parse(
			readFileSync(
				new URL(
					"../../packages/core/content/real/champions/champions.json",
					import.meta.url,
				),
				"utf8",
			),
		) as { id: string; damage: string; cc: number; mobility: number }[]
	).map((champion) => [champion.id, champion]),
);

it("the derived profile of well-known champions is sensible", () => {
	for (const [id, damage, cc, mobility] of expected) {
		const champion = champions.get(id);
		expect(champion, id).toBeDefined();
		expect(damage, `${id} damage ${champion?.damage}`).toContain(
			champion?.damage,
		);
		expect(champion?.cc, `${id} cc`).toBeGreaterThanOrEqual(cc[0]);
		expect(champion?.cc, `${id} cc`).toBeLessThanOrEqual(cc[1]);
		expect(champion?.mobility, `${id} mobility`).toBeGreaterThanOrEqual(
			mobility[0],
		);
		expect(champion?.mobility, `${id} mobility`).toBeLessThanOrEqual(
			mobility[1],
		);
	}
});
