import { ROLES } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { packagedMatchContent } from "../content/match";
import timelines from "../content/real/timelines.json";
import { levelAt, respawnTime } from "./death-timer";

const { deathTimer, levelCurve } = packagedMatchContent.rules;

/** Seconds of the game at m:ss. */
const at = (minute: number, second: number) => minute * 60 + second;

describe("D1 · death time follows the wiki formula (#528)", () => {
	// BRW + BRW × TIF, rounded half to even in tenths and up to whole seconds.
	// Cases worked out by hand from https://wiki.leagueoflegends.com/en-us/Death.
	it.each([
		["level 1 at the start", 1, at(0, 0), 10],
		["level 6 at 14:59", 6, at(14, 59), 16],
		["level 18 at 14:59, no increase yet", 18, at(14, 59), 53],
		["level 18 at 15:00, first step still 0", 18, at(15, 0), 53],
		["level 18 at 15:30, one step of 0.425 %", 18, at(15, 30), 53],
		["level 18 at 29:59, 30 steps of 0.425 %", 18, at(29, 59), 60],
		["level 18 at 30:00, 12.75 %", 18, at(30, 0), 60],
		["level 18 at 45:00, 21.75 %", 18, at(45, 0), 64],
		["level 18 at 55:00, capped at 50 %", 18, at(55, 0), 79],
		["level 18 at 70:00, still capped", 18, at(70, 0), 79],
	])("%s", (_, level, second, seconds) => {
		expect(respawnTime(deathTimer, level, second)).toBe(second + seconds);
	});

	it("rounds the tenths of increase half to even", () => {
		// 100 tenths of BRW: an increase of 20.5 tenths rounds to 20 (even), so
		// 120 tenths are 12 s; half up would give 121 tenths, 13 s.
		const flat = { ...deathTimer, brw: deathTimer.brw.map(() => 100) };
		const only = (base: number) => ({
			...flat,
			tif: [{ from: 0, base, perStep: 0 }],
		});
		expect(respawnTime(only(20_500), 1, 0)).toBe(12);
		expect(respawnTime(only(19_500), 1, 0)).toBe(12);
		expect(respawnTime(only(21_500), 1, 0)).toBe(13);
	});

	it("reads the table from the rules, so a patch only changes data", () => {
		const flat = { ...deathTimer, brw: deathTimer.brw.map(() => 200) };
		expect(respawnTime(flat, 1, 0)).toBe(20);
		expect(respawnTime(flat, 18, at(15, 0))).toBe(at(15, 0) + 20);
	});

	it("the packaged table is the wiki one: 10 s at level 1 up to 52.5 s at 18", () => {
		expect(deathTimer.brw[0]).toBe(100);
		expect(deathTimer.brw[17]).toBe(525);
		expect(deathTimer.brw).toHaveLength(18);
		expect(deathTimer.cap).toBe(50_000);
	});

	it("clamps levels outside 1 to 18", () => {
		expect(respawnTime(deathTimer, 0, 0)).toBe(respawnTime(deathTimer, 1, 0));
		expect(respawnTime(deathTimer, 25, 0)).toBe(respawnTime(deathTimer, 18, 0));
	});
});

describe("level curve (until #338 computes each player's level)", () => {
	it("is the median level of the timelines of #527", () => {
		expect(levelCurve).toEqual(timelines.levelCurve);
	});

	it("gives a whole level per role and game second", () => {
		for (const role of ROLES) {
			expect(levelAt(levelCurve, role, at(0, 30))).toBe(1);
			expect(levelAt(levelCurve, role, at(40, 0))).toBeGreaterThanOrEqual(15);
			expect(levelAt(levelCurve, role, at(40, 0))).toBeLessThanOrEqual(18);
		}
	});

	it("keeps the last minute of the curve for longer games", () => {
		const last = levelCurve.top.length;
		expect(levelAt(levelCurve, "top", at(last + 20, 0))).toBe(
			levelAt(levelCurve, "top", at(last - 1, 30)),
		);
	});
});
