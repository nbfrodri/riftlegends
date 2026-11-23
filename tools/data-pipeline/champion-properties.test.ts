import fc from "fast-check";
import { expect, it } from "vitest";
import { deriveChampionContent } from "./champion-content.ts";
import { score } from "./champion-rules.ts";

const prior = (points: number) => [{ reason: "range" as const, points }];

it("rounds an exact half by magnitude after blending the sample", () => {
	expect(score(prior(-1), 20, 20, { games: 12, wins: 11 }).value).toBe(3);
	expect(score(prior(1), 20, 20, { games: 12, wins: 1 }).value).toBe(-3);
});

it("moves toward the observed value as the same win rate gains samples", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: -6, max: 6 }),
			fc.integer({ min: 0, max: 10 }),
			fc.integer({ min: 1, max: 20 }),
			fc.integer({ min: 1, max: 50 }),
			(points, wins, copies, addedCopies) => {
				const value = (n: number) =>
					score(prior(points), 20, 20, {
						games: 10 * n,
						wins: wins * n,
					}).value;
				const observed = 2 * wins - 10;
				expect(
					Math.abs(value(copies + addedCopies) - observed),
				).toBeLessThanOrEqual(Math.abs(value(copies) - observed));
				expect(value(copies)).toBe(
					-score(prior(-points), 20, 20, {
						games: 10 * copies,
						wins: (10 - wins) * copies,
					}).value || 0,
				);
			},
		),
		{ seed: 321 },
	);
});

it("generates identical bytes regardless of catalog order", () => {
	const catalog = [
		"Galio",
		"Yasuo",
		"MissFortune",
		"Malphite",
		"Blitzcrank",
	].map((id, key) => ({ id, key, classes: [] }));
	const expected = JSON.stringify(deriveChampionContent(catalog, []));
	fc.assert(
		fc.property(
			fc.shuffledSubarray(catalog, {
				minLength: catalog.length,
				maxLength: catalog.length,
			}),
			(shuffled) => {
				expect(JSON.stringify(deriveChampionContent(shuffled, []))).toBe(
					expected,
				);
			},
		),
		{ seed: 321 },
	);
});
