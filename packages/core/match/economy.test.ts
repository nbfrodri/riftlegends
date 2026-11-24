import { ROLES, type Role } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	DAMAGE_SHARE,
	FARM_SHARE,
	farmed,
	restOfEvent,
	split,
	splitDamage,
} from "./economy";
import { matchSetup } from "./fixtures/setup";
import { playGame } from "./play";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const by = (parts: readonly number[]) =>
	Object.fromEntries(ROLES.map((role, i) => [role, parts[i]])) as Record<
		Role,
		number
	>;

describe("G1 · every gold has an owner (#347)", () => {
	it("split adds up exactly and gives the rest to the largest remainders", () => {
		fc.assert(
			fc.property(
				fc.nat(1_000_000),
				fc.array(fc.nat(10_000), { minLength: 1, maxLength: 5 }),
				(total, weights) => {
					const parts = split(total, weights);
					expect(sum(parts)).toBe(sum(weights) === 0 ? 0 : total);
					expect(parts.every((n) => n >= 0)).toBe(true);
				},
			),
		);
		// 10 over five equal parts: nothing left. 7 over three: ties go first.
		expect(split(7, [1, 1, 1])).toEqual([3, 2, 2]);
		expect(split(0, [1, 2])).toEqual([0, 0]);
		expect(split(5, [0, 0])).toEqual([0, 0]);
	});

	it("farm shares and damage shares are the 100 % of the team", () => {
		expect(sum(Object.values(FARM_SHARE))).toBe(10_000);
		expect(sum(Object.values(DAMAGE_SHARE))).toBe(10_000);
	});

	it("the passive income goes by role and the support farms the least", () => {
		const farm = by(farmed(2000));
		expect(sum(Object.values(farm))).toBe(2000);
		expect(farm.support).toBeLessThan(farm.top);
		expect(farm.support).toBeLessThan(farm.jungle);
		expect(farm.bot).toBeGreaterThan(farm.mid);
	});

	it("lane gold goes to the laners; the bottom lane is 80 % ADC, 20 % support", () => {
		expect(
			by(restOfEvent({ kind: "lane", zone: "lane-top" }, 150)),
		).toMatchObject({ top: 150, jungle: 0, support: 0 });
		expect(
			by(restOfEvent({ kind: "lane", zone: "lane-mid" }, 150)),
		).toMatchObject({ mid: 150, bot: 0 });
		expect(by(restOfEvent({ kind: "lane", zone: "lane-bot" }, 150))).toEqual({
			top: 0,
			jungle: 0,
			mid: 0,
			bot: 120,
			support: 30,
		});
	});

	it("a tower pays half to its lane and half to the five; the rest, the five", () => {
		const top = by(
			restOfEvent({ kind: "tower", zone: "lane-top", tier: 1 }, 550),
		);
		expect(top).toEqual({
			top: 275 + 55,
			jungle: 55,
			mid: 55,
			bot: 55,
			support: 55,
		});
		for (const kind of ["dragon", "baron", "inhibitor", "fight"] as const) {
			expect(
				by(restOfEvent({ kind, zone: "pit-dragon" as never }, 200)),
			).toEqual({
				top: 40,
				jungle: 40,
				mid: 40,
				bot: 40,
				support: 40,
			});
		}
		// A nexus tower has no lane: it pays the five.
		expect(
			by(restOfEvent({ kind: "tower", zone: "base-red", tier: 4 }, 550)),
		).toMatchObject({ top: 110, support: 110 });
	});

	it("the damage split keeps the team total and follows the role", () => {
		fc.assert(
			fc.property(
				fc.array(fc.nat(30_000), { minLength: 5, maxLength: 5 }),
				(own) => {
					const parts = splitDamage(own);
					expect(sum(parts)).toBe(sum(own));
				},
			),
		);
		const even = by(splitDamage([10_000, 10_000, 10_000, 10_000, 10_000]));
		expect(even.bot).toBeGreaterThan(even.mid);
		expect(even.mid).toBeGreaterThan(even.top);
		expect(even.top).toBeGreaterThan(even.jungle);
		expect(even.jungle).toBeGreaterThan(even.support);
	});
});

describe("G1 · in real games", () => {
	const SEEDS = [1, 2, 3, 7, 11, 42, 99, 123];

	it("the five players add up to the side's gold in every snapshot", () => {
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			for (const snapshot of snapshots) {
				const side = (which: "blue" | "red") =>
					sum(
						snapshot.players
							.slice(which === "blue" ? 0 : 5, which === "blue" ? 5 : 10)
							.map((p) => p.gold),
					);
				expect(side("blue")).toBe(snapshot.blue.gold);
				expect(side("red")).toBe(snapshot.red.gold);
			}
		}
	});

	it("a support never out-earns the ADC of their team", () => {
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			const last = snapshots.at(-1);
			for (const [adc, support] of [
				[3, 4],
				[8, 9],
			] as const) {
				expect(last?.players[support]?.gold).toBeLessThan(
					last?.players[adc]?.gold ?? 0,
				);
			}
		}
	});

	it("is deterministic: the same seed gives the same gold and damage", () => {
		const a = playGame(matchSetup({ seed: 5 }));
		const b = playGame(matchSetup({ seed: 5 }));
		expect(a.facts).toEqual(b.facts);
		expect(a.snapshots).toEqual(b.snapshots);
	});
});
