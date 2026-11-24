import { describe, expect, it } from "vitest";
import { DRAFT_ORDER } from "../draft/order";
import { type BankGame, inferFearless, proDrafts, splitOf } from "./bank";

// Recorded from the LCK snapshot (Leaguepedia, CC BY-SA): Gen.G vs BNK FEARX.
const recorded: BankGame = {
	id: "LCK/2026 Season/Cup_Finals_1_1",
	tournament: "LCK/2026 Season/Cup",
	teams: [
		{
			id: "Gen.G",
			side: "blue",
			picks: ["Ryze", "Gwen", "JarvanIV", "Sivir", "Bard"],
			bans: ["Yunara", "Neeko", "Azir", "Karma", "Nautilus"],
		},
		{
			id: "BNK FEARX",
			side: "red",
			picks: ["Varus", "Pantheon", "Taliyah", "Gnar", "Rakan"],
			bans: ["Rumble", "Vi", "Orianna", "Ezreal", "Jhin"],
		},
	],
	winner: "Gen.G",
	draftOrder: true,
};

const game = (id: string, overrides: Partial<BankGame> = {}): BankGame => ({
	...recorded,
	id,
	...overrides,
});

describe("proDrafts", () => {
	it("interleaves each team's ordered bans and picks into the 20 pro steps", () => {
		const [draft] = proDrafts("LCK", [recorded]);
		expect(draft?.actions).toEqual([
			// bans 1: blue, red, blue, red, blue, red
			"Yunara",
			"Rumble",
			"Neeko",
			"Vi",
			"Azir",
			"Orianna",
			// picks 1: blue, red, red, blue, blue, red
			"Ryze",
			"Varus",
			"Pantheon",
			"Gwen",
			"JarvanIV",
			"Taliyah",
			// bans 2: red, blue, red, blue
			"Ezreal",
			"Karma",
			"Jhin",
			"Nautilus",
			// picks 2: red, blue, blue, red
			"Gnar",
			"Sivir",
			"Bard",
			"Rakan",
		]);
		expect(draft?.actions).toHaveLength(DRAFT_ORDER.length);
		expect(draft).toMatchObject({
			league: "LCK",
			blue: "Gen.G",
			red: "BNK FEARX",
			series: "LCK/2026 Season/Cup_Finals_1",
			game: 1,
			winner: "Gen.G",
		});
	});

	it("keeps an empty ban as null", () => {
		const teams = structuredClone(recorded.teams);
		(teams[0] as { bans: (string | null)[] }).bans[4] = null;
		const [draft] = proDrafts("LCK", [game("X_1_1", { teams })]);
		expect(draft?.actions[10 + 3]).toBeNull();
	});

	it.each([
		["a missing draft order", { draftOrder: false }],
		[
			"an unknown pick",
			{
				teams: [
					{
						...recorded.teams[0],
						picks: [null, "Gwen", "JarvanIV", "Sivir", "Bard"],
					},
					recorded.teams[1],
				] as BankGame["teams"],
			},
		],
	])("drops a game with %s", (_, overrides) => {
		expect(proDrafts("LCK", [game("X_1_1", overrides)])).toEqual([]);
	});

	it("numbers games inside a series and remembers the earlier picks", () => {
		const drafts = proDrafts("LCK", [game("T/Cup_A_1_2"), game("T/Cup_A_1_1")]);
		expect(drafts.map((d) => d.game)).toEqual([1, 2]);
		expect(drafts[0]?.previous).toEqual([]);
		expect(drafts[1]?.previous).toEqual([
			{
				"Gen.G": ["Ryze", "Gwen", "JarvanIV", "Sivir", "Bard"],
				"BNK FEARX": ["Varus", "Pantheon", "Taliyah", "Gnar", "Rakan"],
			},
		]);
	});
});

describe("inferFearless", () => {
	const swapped = (id: string): BankGame =>
		game(id, {
			teams: recorded.teams.map((t) => ({
				...t,
				picks: t.picks.map((c) => `${c}-${id}`),
			})) as BankGame["teams"],
		});

	it("is hard when no series ever repeats a pick, off otherwise", () => {
		const unique = Array.from({ length: 6 }, (_, s) => [
			swapped(`T/Cup_S${s}_1_1`),
			swapped(`T/Cup_S${s}_1_2`),
		]).flat();
		expect(
			inferFearless(proDrafts("LCK", unique)).get("LCK/2026 Season/Cup"),
		).toBe("hard");
		const repeating = [...unique, game("T/Cup_R_1_1"), game("T/Cup_R_1_2")];
		expect(
			inferFearless(proDrafts("LCK", repeating)).get("LCK/2026 Season/Cup"),
		).toBe("off");
	});

	it("needs enough series to call it", () => {
		const few = [swapped("T/Cup_A_1_1"), swapped("T/Cup_A_1_2")];
		expect(
			inferFearless(proDrafts("LCK", few)).get("LCK/2026 Season/Cup"),
		).toBe("off");
	});
});

describe("splitOf", () => {
	const ids = Array.from({ length: 400 }, (_, i) => `T/Cup_S${i}_1_1`);
	const drafts = proDrafts(
		"LCK",
		ids.map((id) => game(id)),
	);

	it("is deterministic and depends on the seed", () => {
		const a = drafts.map((d) => splitOf(d, 1));
		expect(drafts.map((d) => splitOf(d, 1))).toEqual(a);
		expect(drafts.map((d) => splitOf(d, 2))).not.toEqual(a);
	});

	it("keeps about 30 % for validation", () => {
		const validation = drafts.filter(
			(d) => splitOf(d, 1) === "validation",
		).length;
		expect(validation).toBeGreaterThan(80);
		expect(validation).toBeLessThan(160);
	});

	it("keeps every game of a series on the same side of the split", () => {
		const series = proDrafts(
			"LCK",
			[1, 2, 3].map((n) => game(`T/Cup_A_1_${n}`)),
		);
		expect(new Set(series.map((d) => splitOf(d, 5))).size).toBe(1);
	});
});
