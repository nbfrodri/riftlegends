import fc from "fast-check";
import { expect, test } from "vitest";
import {
	type AvailabilityInput,
	availability,
	checkChampion,
	requiredPool,
} from "./availability";

const draft: AvailabilityInput = {
	pool: ["jinx", "vi", "ornn", "ahri"],
	fearless: "hard",
	previous: [],
	bans: [],
	picks: {},
};

test("F7: every pool champion starts free in series order, including after an empty ban", () => {
	fc.assert(
		fc.property(
			fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1 }),
			(pool) => {
				const view = availability({ ...draft, pool, bans: [null] }, "north");
				expect(view).toEqual(
					pool.map((champion) => ({ champion, status: "free" })),
				);
			},
		),
	);
});

const unavailable = (champion: string) => ({
	ok: false,
	error: { code: "champion-unavailable", params: { champion } },
});

test("F1: neither team can ban or pick a champion already used in this game or outside the pool", () => {
	const current = {
		...draft,
		bans: ["vi"],
		picks: { north: ["jinx"], south: ["ornn"] },
	};
	for (const team of ["north", "south"]) {
		for (const action of ["ban", "pick"] as const) {
			for (const champion of ["vi", "jinx", "ornn", "unknown"]) {
				expect(checkChampion(current, team, action, champion)).toEqual(
					unavailable(champion),
				);
			}
			expect(checkChampion(current, team, action, "ahri")).toEqual({
				ok: true,
			});
		}
	}
});

test("F2/F6: hard locks both teams' picks through game five, but either team can ban them", () => {
	const previous = [
		{ north: ["vi"], south: [] },
		{ north: [], south: ["ornn"] },
		{ north: [], south: ["jinx"] },
		{ north: ["ahri"], south: [] },
	];
	const current = { ...draft, previous };
	for (const team of ["north", "south"]) {
		expect(availability(current, team)).toEqual([
			{ champion: "jinx", status: "fearless", team: "south" },
			{ champion: "vi", status: "fearless", team: "north" },
			{ champion: "ornn", status: "fearless", team: "south" },
			{ champion: "ahri", status: "fearless", team: "north" },
		]);
		for (const champion of current.pool) {
			expect(checkChampion(current, team, "pick", champion)).toEqual(
				unavailable(champion),
			);
			expect(checkChampion(current, team, "ban", champion)).toEqual({
				ok: true,
			});
		}
	}
});

test("F3/F6: soft locks each team's own picks, even if both teams have played the champion", () => {
	const current = {
		...draft,
		fearless: "soft" as const,
		previous: [{ north: ["vi", "jinx"] }, { south: ["jinx"] }],
	};
	for (const team of ["north", "south"]) {
		expect(availability(current, team)).toEqual([
			{ champion: "jinx", status: "fearless", team },
			team === "north"
				? { champion: "vi", status: "fearless", team }
				: { champion: "vi", status: "free" },
			{ champion: "ornn", status: "free" },
			{ champion: "ahri", status: "free" },
		]);
		expect(checkChampion(current, team, "ban", "jinx")).toEqual({ ok: true });
		expect(checkChampion(current, team, "pick", "jinx")).toEqual(
			unavailable("jinx"),
		);
	}
	expect(checkChampion(current, "south", "pick", "vi")).toEqual({ ok: true });
});

test("F4: off makes both teams' previous picks free again", () => {
	const current = {
		...draft,
		fearless: "off" as const,
		previous: [{ north: ["vi"], south: ["jinx"] }],
	};
	for (const team of ["north", "south"]) {
		expect(availability(current, team)).toEqual(
			draft.pool.map((champion) => ({ champion, status: "free" })),
		);
		expect(checkChampion(current, team, "pick", "vi")).toEqual({ ok: true });
	}
});

test("F5: only picks carry into the next game", () => {
	const first = { ...draft, bans: ["vi"], picks: { south: ["ornn"] } };
	expect(checkChampion(first, "south", "pick", "vi")).toEqual(
		unavailable("vi"),
	);
	const second = { ...draft, previous: [first.picks] };
	expect(checkChampion(second, "south", "pick", "vi")).toEqual({ ok: true });
	expect(checkChampion(second, "south", "pick", "ornn")).toEqual(
		unavailable("ornn"),
	);
});

test("F7: picks take precedence over bans, and bans over fearless locks", () => {
	const current = {
		...draft,
		previous: [{ north: ["vi", "ornn", "ahri"] }],
		bans: ["vi", "ornn"],
		picks: { south: ["ornn"] },
	};
	expect(availability(current, "north")).toEqual([
		{ champion: "jinx", status: "free" },
		{ champion: "vi", status: "banned" },
		{ champion: "ornn", status: "picked", team: "south" },
		{ champion: "ahri", status: "fearless", team: "north" },
	]);
	expect(checkChampion(current, "south", "ban", "vi")).toEqual(
		unavailable("vi"),
	);
});

test.each([
	["bo1", 20],
	["bo3", 40],
	["bo5", 60],
] as const)(
	"F8: %s reserves enough champions through the last possible game",
	(format, minimum) => {
		expect(requiredPool(format, "hard")).toBe(minimum);
		expect(requiredPool(format, "soft")).toBe(minimum);
		expect(requiredPool(format, "off")).toBe(20);
	},
);
