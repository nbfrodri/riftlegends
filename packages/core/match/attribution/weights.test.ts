import { ROLES } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { ASSIST_BASE, KILL_BASE, roleWeights } from "./weights";

const neutral = {
	mechanics: 50,
	positioning: 50,
	communication: 50,
	teamfight: 50,
};

describe("R1: attribution weights", () => {
	it("start from the base weights of each role with a neutral player", () => {
		for (const role of ROLES) {
			const w = roleWeights(role, [], neutral);
			expect(w.kill).toBe(KILL_BASE[role] * 1_000_000);
			expect(w.assist).toBe(ASSIST_BASE[role] * 1_000_000);
		}
	});

	it("favour carries and dives for kills and engage, peel and utility for assists", () => {
		const base = roleWeights("mid", [], neutral);
		expect(roleWeights("mid", ["carry"], neutral).kill).toBeGreaterThan(
			base.kill,
		);
		expect(roleWeights("mid", ["hypercarry"], neutral).kill).toBeGreaterThan(
			base.kill,
		);
		expect(roleWeights("mid", ["dive"], neutral).kill).toBeGreaterThan(
			base.kill,
		);
		expect(roleWeights("mid", ["utility"], neutral).kill).toBeLessThan(
			base.kill,
		);
		for (const archetype of ["engage", "peel", "utility"] as const) {
			expect(roleWeights("mid", [archetype], neutral).assist).toBeGreaterThan(
				base.assist,
			);
		}
		expect(roleWeights("mid", ["carry"], neutral).assist).toBeLessThan(
			base.assist,
		);
	});

	it("opposed and favoured archetypes cancel out", () => {
		expect(roleWeights("mid", ["carry", "utility"], neutral).kill).toBe(
			roleWeights("mid", [], neutral).kill,
		);
	});

	it("raise with the attributes that matter and never move more than 25 % per factor", () => {
		const base = roleWeights("bot", [], neutral);
		const sharp = roleWeights("bot", [], {
			...neutral,
			mechanics: 100,
			positioning: 100,
		});
		const dull = roleWeights("bot", [], {
			...neutral,
			mechanics: 0,
			positioning: 0,
		});
		expect(sharp.kill).toBeGreaterThan(base.kill);
		expect(dull.kill).toBeLessThan(base.kill);
		expect(sharp.kill).toBeLessThanOrEqual((base.kill * 125) / 100);
		expect(dull.kill).toBeGreaterThanOrEqual((base.kill * 75) / 100);
		const vocal = roleWeights("bot", [], {
			...neutral,
			communication: 100,
			teamfight: 100,
		});
		expect(vocal.assist).toBeGreaterThan(base.assist);
		expect(vocal.assist).toBeLessThanOrEqual((base.assist * 125) / 100);
		const worst = roleWeights("bot", ["carry", "hypercarry"], {
			...neutral,
			mechanics: 100,
			positioning: 100,
		});
		expect(worst.kill).toBeLessThanOrEqual((base.kill * 125 * 125) / 10_000);
	});

	it("leave the support the smallest kill weight and the largest assist weight", () => {
		const kills = ROLES.map((r) => roleWeights(r, [], neutral).kill);
		const assists = ROLES.map((r) => roleWeights(r, [], neutral).assist);
		expect(Math.min(...kills)).toBe(roleWeights("support", [], neutral).kill);
		expect(Math.max(...assists)).toBe(
			roleWeights("support", [], neutral).assist,
		);
	});
});
