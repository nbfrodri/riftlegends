import { expect, it } from "vitest";
import { SCALE } from "../../math";
import type { AiContext } from "../context";
import { points, scenario } from "../fixtures/scenario";
import { scorePick } from "./pick";

const score = (key: string, id: string, overrides: Partial<AiContext> = {}) =>
	points(scorePick(scenario(overrides), id), key);

it("A1 scores tier in a feasible position, including after reassigning a flex", () => {
	const occupiedMid = { picks: { forge: ["glasswake"] } };
	expect(score("meta", "cragbell")).toBeGreaterThan(score("meta", "mosshelm"));
	expect(score("meta", "rimefoil", occupiedMid)).toBe(
		score("meta", "mosshelm", occupiedMid),
	);
	expect(score("meta", "rimefoil", { picks: { forge: ["cragbell"] } })).toBe(
		score("meta", "glasswake"),
	);
	expect(
		score("meta", "mosshelm", { picks: { forge: ["rimefoil"] } }),
	).toBeGreaterThan(0);
	expect(score("meta", "cragbell", { picks: { forge: ["mosshelm"] } })).toBe(0);
});

it("A2 scores the pool of the player in the available role", () => {
	const comfort = (id: string) => score("comfort", id);
	expect(comfort("cragbell")).toBeGreaterThan(comfort("saltspire"));
	expect(comfort("saltspire")).toBeGreaterThan(comfort("mosshelm"));
	expect(comfort("mosshelm")).toBeGreaterThan(comfort("siltwing"));
	expect(
		score("comfort", "cragbell", { team: "shoal", rival: "forge" }),
	).toBeLessThan(0);
	expect(score("comfort", "rimefoil", { picks: { forge: ["cragbell"] } })).toBe(
		comfort("saltspire"),
	);
});

it("A3 scores explicit combos symmetrically by intensity and only with live own picks", () => {
	const combo = (id: string, ally: string) =>
		score("synergy", id, { picks: { forge: [ally] } });
	expect(combo("shellward", "suncord")).toBe(6 * SCALE);
	expect(combo("suncord", "shellward")).toBe(combo("shellward", "suncord"));
	expect(combo("briarshot", "glasswake")).toBe(3 * SCALE);
	expect(
		score("synergy", "suncord", {
			bans: ["shellward", null],
			picks: { shoal: ["riftchime"] },
		}),
	).toBe(0);
	expect(score("synergy", "suncord", { picks: { shoal: ["shellward"] } })).toBe(
		0,
	);
});

it.each([
	["amberwall", "chalkmaw"],
	["bronzehook", "frostdrum"],
	["suncord", "copperfin"],
	["shellward", "nettleguard"],
])(
	"A4 values %s for coverage until %s fills its job",
	(candidate, existing) => {
		expect(score("composition", candidate)).toBeGreaterThan(
			score("composition", candidate, { picks: { forge: [existing] } }),
		);
	},
);

it("A4 balances physical and magic sources, counting mixed damage and ignoring utility", () => {
	const after = (ids: string[], candidate: string) =>
		score("composition", candidate, { picks: { forge: ids } });
	expect(after(["siltwing"], "prismoth")).toBeGreaterThan(
		after([], "prismoth"),
	);
	expect(after(["duskroot"], "briarshot")).toBeGreaterThan(
		after([], "briarshot"),
	);
	expect(after(["duskroot", "quillforge"], "prismoth")).toBeLessThan(0);
	expect(after(["siltwing"], "cinderlens")).toBeGreaterThan(
		after([], "cinderlens"),
	);
	expect(after(["shellward"], "prismoth")).toBe(after([], "prismoth"));
});

it("A5 scores directed lane matchups only where both champions can still play", () => {
	const vs = (forge: string[], shoal: string[], id: string) =>
		score("matchup", id, { picks: { forge, shoal } });
	expect(vs([], ["rimefoil"], "glasswake")).toBe(4 * SCALE);
	expect(vs([], ["waxblade"], "glasswake")).toBe(-3 * SCALE);
	expect(vs([], ["rimefoil", "prismoth"], "glasswake")).toBe(0);
	expect(vs(["mosshelm"], ["cragbell"], "rimefoil")).toBe(0);
});

it("A6 rewards flex only with two roster-backed, simultaneously completable assignments", () => {
	expect(score("flex", "rimefoil")).toBeGreaterThan(0);
	expect(score("flex", "rimefoil", { team: "shoal", rival: "forge" })).toBe(0);
	expect(score("flex", "rimefoil", { picks: { forge: ["cragbell"] } })).toBe(0);
	expect(score("flex", "cragbell")).toBe(0);
	// Top can play the flex, but every other trusted top option is gone.
	expect(
		score("flex", "rimefoil", {
			bans: ["saltspire"],
			picks: { shoal: ["cragbell"] },
		}),
	).toBe(0);
});

it("A7 reinforces an established identity only after two allied picks and its threshold", () => {
	const siege = (ids: string[], candidate = "starloom") =>
		score("identity", candidate, { picks: { forge: ids } });
	expect(siege(["prismoth", "briarshot"])).toBeGreaterThan(0);
	expect(siege(["prismoth"])).toBe(0);
	expect(siege(["prismoth", "bronzehook"])).toBe(0);
	expect(siege(["prismoth", "briarshot"], "fenveil")).toBe(0);
	expect(siege(["duskroot", "fenveil"], "cinderlens")).toBe(0);
});

it("A5 uses the least favorable plausible opponent when two flex picks could swap lanes", () => {
	const { content } = scenario();
	const matchups = [
		...content.matchups,
		{
			champion: "glasswake",
			against: "tideglass",
			role: "mid" as const,
			value: 2,
		},
	];
	expect(
		score("matchup", "glasswake", {
			content: { ...content, matchups },
			picks: { shoal: ["rimefoil", "tideglass"] },
		}),
	).toBe(2 * SCALE);
});

it("A6 needs a playable champion for each remaining player", () => {
	const { content } = scenario();
	const players = content.players.map((p) =>
		p.team === "forge" && p.role === "mid"
			? { ...p, mains: ["cragbell"], secondary: ["rimefoil"] }
			: p,
	);
	expect(score("flex", "rimefoil", { content: { ...content, players } })).toBe(
		0,
	);
});
