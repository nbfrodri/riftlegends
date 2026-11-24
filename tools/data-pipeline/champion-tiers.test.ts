import fc from "fast-check";
import { expect, it } from "vitest";
import { rankTiers, SMALL_SAMPLE, type Tier } from "./champion-presence.ts";

const order: Tier[] = ["S+", "S", "A", "B", "C", "D"];
const quota = { "S+": 3, S: 8, A: 17, B: 27, C: 30, D: 15 } as const;

const rows = fc
	.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
		minLength: 1,
		maxLength: 120,
	})
	.chain((ids) =>
		fc.tuple(
			fc.constant(ids),
			fc.array(fc.integer({ min: 0, max: 40 }), {
				minLength: ids.length,
				maxLength: ids.length,
			}),
		),
	)
	.map(([ids, scores]) =>
		ids.map((id, i) => ({ id, score: scores[i] ?? 0, samples: 1000 })),
	);

it("assigns each role by quota, in score order, ties broken by id", () => {
	fc.assert(
		fc.property(rows, (input) => {
			const tiers = rankTiers(input);
			const sorted = [...input].sort(
				(a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
			);
			const indexes = sorted.map(({ id }) => order.indexOf(tiers.get(id)!));
			// Better score never gets a worse tier.
			expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
			// Counts follow the cumulative quotas within one champion.
			let cumulative = 0;
			let boundary = 0;
			for (const tier of order) {
				cumulative += quota[tier];
				const next = Math.floor((input.length * cumulative + 50) / 100);
				const count = indexes.filter((i) => order[i] === tier).length;
				expect(count).toBe(next - boundary);
				boundary = next;
			}
		}),
	);
});

it("gives the documented counts for 280 champions", () => {
	const input = Array.from({ length: 280 }, (_, i) => ({
		id: `c${String(i).padStart(3, "0")}`,
		score: 280 - i,
		samples: 1000,
	}));
	const counts = new Map<Tier, number>();
	for (const tier of rankTiers(input).values())
		counts.set(tier, (counts.get(tier) ?? 0) + 1);
	expect(order.map((tier) => counts.get(tier))).toEqual([8, 23, 47, 76, 84, 42]);
});

it("breaks ties by id", () => {
	const input = ["b", "a", "c"].map((id) => ({ id, score: 5, samples: 1000 }));
	const tiers = rankTiers(input);
	expect([tiers.get("a"), tiers.get("b"), tiers.get("c")]).toEqual([
		"A",
		"B",
		"C",
	]);
});

it("never puts a small sample above B", () => {
	fc.assert(
		fc.property(rows, (input) => {
			const small = input.map((row, i) => ({
				...row,
				samples: i % 2 ? SMALL_SAMPLE - 1 : 1000,
			}));
			const tiers = rankTiers(small);
			for (const row of small.filter(({ samples }) => samples < SMALL_SAMPLE))
				expect(order.indexOf(tiers.get(row.id)!)).toBeGreaterThanOrEqual(
					order.indexOf("B"),
				);
		}),
	);
});
