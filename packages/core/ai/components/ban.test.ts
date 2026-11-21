import fc from "fast-check";
import { expect, it } from "vitest";
import { SCALE } from "../../math";
import type { AiContext } from "../context";
import { points, scenario } from "../fixtures/scenario";
import { scoreBan } from "./ban";

const ban = (key: string, id: string, overrides: Partial<AiContext> = {}) =>
	points(scoreBan(scenario({ step: 0, ...overrides }), id), key);

it("uses public meta when rival pools are hidden", () => {
	expect(ban("meta", "suncord", { knowsRivalPools: false })).toBeGreaterThan(
		ban("meta", "copperfin", { knowsRivalPools: false }),
	);
});

it("A3 credits a ban for breaking a rival combo, with no credit for a banned partner", () => {
	expect(ban("synergy", "suncord", { picks: { shoal: ["shellward"] } })).toBe(
		6 * SCALE,
	);
	expect(ban("synergy", "suncord", { picks: { forge: ["shellward"] } })).toBe(
		0,
	);
	expect(ban("synergy", "suncord", { bans: [null, "shellward"] })).toBe(0);
});

it("B1 targets rival comfort in proportion to player level, only with scouting", () => {
	const { content } = scenario();
	fc.assert(
		fc.property(fc.integer({ min: 1, max: 100 }), (level) => {
			const players = content.players.map((p) =>
				p.team === "shoal" && p.role === "bot" ? { ...p, level } : p,
			);
			const ctx = { content: { ...content, players } };
			expect(ban("targetBan", "suncord", ctx)).toBe(4 * level * (SCALE / 100));
			expect(ban("targetBan", "copperfin", ctx)).toBe(
				2 * level * (SCALE / 100),
			);
			expect(
				ban("targetBan", "suncord", { ...ctx, knowsRivalPools: false }),
			).toBe(0);
		}),
	);
	expect(ban("targetBan", "suncord")).toBeGreaterThan(
		ban("targetBan", "shellward"),
	);
	// Rival bot is locked and cannot use their main.
	expect(ban("targetBan", "suncord", { picks: { shoal: ["rillbow"] } })).toBe(
		0,
	);
});

it("B2 protects exposed carries from dive, especially in second-phase bans", () => {
	const early = ban("threatBan", "coalstride", {
		step: 0,
		picks: { forge: ["suncord"] },
	});
	expect(early).toBeGreaterThan(0);
	expect(
		ban("threatBan", "coalstride", { step: 13, picks: { forge: ["suncord"] } }),
	).toBeGreaterThan(early);
	expect(
		ban("threatBan", "coalstride", {
			picks: { forge: ["suncord", "shellward"] },
		}),
	).toBe(0);
	expect(ban("threatBan", "coalstride")).toBe(0);
});

it("B2 recognizes engage against poke and hypercarry against a tankless lineup", () => {
	const threat = (id: string, allies: string[]) =>
		ban("threatBan", id, { step: 13, picks: { forge: allies } });
	expect(threat("bronzehook", ["prismoth"])).toBeGreaterThan(0);
	expect(threat("bronzehook", ["suncord"])).toBe(0);
	expect(threat("suncord", ["glasswake"])).toBeGreaterThan(0);
	expect(threat("suncord", ["glasswake", "cragbell"])).toBe(0);
});
