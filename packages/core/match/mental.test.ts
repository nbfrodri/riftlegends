import type { MatchContent, PlayerAttribute } from "@rift-legends/contracts";
import { PLAYER_ATTRIBUTES } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "./fixtures/content";
import { mentalEdge, type SeriesContext } from "./mental";
import type { Lineup } from "./profile";

const forge: Lineup = {
	team: "forge",
	roles: {
		top: "cragbell",
		jungle: "duskroot",
		mid: "glasswake",
		bot: "copperfin",
		support: "bronzehook",
	},
};

/** Forge with every attribute at 50 and coach adaptation 50: nothing stands out. */
const neutral: MatchContent = {
	...fictionalMatchContent,
	players: fictionalMatchContent.players.map((p) =>
		p.id.startsWith("forge-")
			? {
					...p,
					attributes: Object.fromEntries(
						PLAYER_ATTRIBUTES.map((k) => [k, 50]),
					) as typeof p.attributes,
				}
			: p,
	),
	teams: fictionalMatchContent.teams.map((t) =>
		t.id === "forge" ? { ...t, adaptation: 50 } : t,
	),
};

const regular: SeriesContext = {
	game: 1,
	decisive: false,
	stage: "regular",
	results: [],
};

type Player = MatchContent["players"][number];

/** Sets one attribute of the whole team, or of the players `only` picks. */
const tuned = (
	attribute: PlayerAttribute,
	value: number,
	only?: (p: Player) => boolean,
): MatchContent => ({
	...neutral,
	players: neutral.players.map((p) =>
		p.id.startsWith("forge-") && (only?.(p) ?? true)
			? { ...p, attributes: { ...p.attributes, [attribute]: value } }
			: p,
	),
});

const edge = (
	context: Partial<SeriesContext> = {},
	match = neutral,
	side: "blue" | "red" = "red",
) =>
	mentalEdge(fictionalContent, match, forge, side, { ...regular, ...context });

const sum = (s: { causes: readonly { points: number }[] }) =>
	s.causes.reduce((t, c) => t + c.points, 0);

describe("mentalEdge", () => {
	it("is neutral in game 1 of a regular series, red side, neutral attributes", () => {
		const e = edge();
		expect(e.general.total).toBe(0);
		expect(e.variance).toBe(10_000);
		expect(e.byContest.objective?.total ?? 0).toBe(0);
		expect(e.byContest.fight?.total ?? 0).toBe(0);
	});

	it("F6: blue side adds the rule, red adds nothing", () => {
		expect(edge({}, neutral, "blue").general.total).toBe(
			neutral.rules.blueSide,
		);
		expect(edge({}, neutral, "red").general.total).toBe(0);
	});

	it("causes add up to each total", () => {
		const e = edge(
			{
				game: 5,
				decisive: true,
				stage: "final",
				results: ["loss", "loss"],
				rivalEdge: "fight",
			},
			fictionalMatchContent,
			"blue",
		);
		expect(sum(e.general)).toBe(e.general.total);
		for (const scored of Object.values(e.byContest)) {
			expect(sum(scored)).toBe(scored.total);
		}
	});

	describe("F7 composure", () => {
		const decisive = { decisive: true } as const;
		it("high composure helps and low hurts in a decisive game", () => {
			expect(
				edge(decisive, tuned("composure", 80)).general.total,
			).toBeGreaterThan(0);
			expect(edge(decisive, tuned("composure", 20)).general.total).toBeLessThan(
				0,
			);
		});
		it("does nothing in an ordinary regular game", () => {
			expect(edge({}, tuned("composure", 90)).general.total).toBe(0);
		});
		it("counts in playoffs even if not decisive", () => {
			expect(
				edge({ stage: "playoffs" }, tuned("composure", 90)).general.total,
			).toBeGreaterThan(0);
		});
	});

	describe("F8 momentum", () => {
		it("a win in the previous game adds confidence", () => {
			expect(edge({ game: 2, results: ["win"] }).general.total).toBeGreaterThan(
				0,
			);
		});
		it("two losses in a row hurt", () => {
			expect(
				edge({ game: 3, results: ["loss", "loss"] }).general.total,
			).toBeLessThan(0);
		});
		it("a single loss does not", () => {
			expect(edge({ game: 2, results: ["loss"] }).general.total).toBe(0);
		});
		it("resilience softens the slump", () => {
			const slump = { game: 3, results: ["loss", "loss"] } as const;
			expect(
				edge(slump, tuned("resilience", 90)).general.total,
			).toBeGreaterThan(edge(slump, tuned("resilience", 20)).general.total);
		});
	});

	describe("F9 experience", () => {
		const big = { stage: "final" } as const;
		it("veterans suffer less pressure in big stages", () => {
			expect(edge(big, tuned("experience", 90)).general.total).toBeGreaterThan(
				edge(big, tuned("experience", 20)).general.total,
			);
		});
		it("pressure is zero in the regular season", () => {
			expect(edge({}, tuned("experience", 10)).general.total).toBe(0);
		});
	});

	describe("F10 consistency", () => {
		it("lower consistency means more variance", () => {
			expect(edge({}, tuned("consistency", 30)).variance).toBeGreaterThan(
				10_000,
			);
			expect(edge({}, tuned("consistency", 80)).variance).toBeLessThan(10_000);
		});
		it("does not change the points", () => {
			expect(edge({}, tuned("consistency", 10)).general.total).toBe(0);
		});
		it("falls or holds as consistency rises", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 0, max: 100 }),
					fc.integer({ min: 0, max: 100 }),
					(a, b) => {
						const [low, high] = a <= b ? [a, b] : [b, a];
						expect(
							edge({}, tuned("consistency", high)).variance,
						).toBeLessThanOrEqual(edge({}, tuned("consistency", low)).variance);
					},
				),
			);
		});
	});

	describe("F11 shotcalling", () => {
		const leader = (p: Player) => p.leader;
		it("the leader adds to objectives and fights only", () => {
			const e = edge({}, tuned("shotcalling", 90, leader));
			expect(e.byContest.objective?.total).toBeGreaterThan(0);
			expect(e.byContest.fight?.total).toBeGreaterThan(0);
			expect(e.byContest.lane).toBeUndefined();
			expect(e.general.total).toBe(0);
		});
		it("a weak caller hurts", () => {
			expect(
				edge({}, tuned("shotcalling", 20, leader)).byContest.fight?.total,
			).toBeLessThan(0);
		});
		it("ignores players who are not the leader", () => {
			const e = edge(
				{},
				tuned("shotcalling", 95, (p) => !p.leader),
			);
			expect(e.byContest.fight?.total ?? 0).toBe(0);
		});
	});

	describe("F12 adaptation", () => {
		const withAdaptation = (value: number): MatchContent => ({
			...neutral,
			teams: neutral.teams.map((t) =>
				t.id === "forge" ? { ...t, adaptation: value } : t,
			),
		});
		const lost = { game: 2, results: ["loss"], rivalEdge: "siege" } as const;
		it("adds in the contest the rival won, after a loss", () => {
			const e = edge(lost, withAdaptation(90));
			expect(e.byContest.siege?.total).toBeGreaterThan(0);
			expect(e.byContest.lane).toBeUndefined();
		});
		it("a poor coach adds less", () => {
			expect(
				edge(lost, withAdaptation(90)).byContest.siege?.total,
			).toBeGreaterThan(
				edge(lost, withAdaptation(20)).byContest.siege?.total ?? 0,
			);
		});
		it("does nothing after a win", () => {
			const e = edge({ ...lost, results: ["win"] }, withAdaptation(90));
			expect(e.byContest.siege).toBeUndefined();
		});
	});

	describe("focus", () => {
		it("matters from game 4 on", () => {
			expect(
				edge({ game: 4 }, tuned("focus", 80)).general.total,
			).toBeGreaterThan(0);
			expect(edge({ game: 5 }, tuned("focus", 20)).general.total).toBeLessThan(
				0,
			);
		});
		it("does nothing in the early games", () => {
			expect(edge({ game: 3 }, tuned("focus", 90)).general.total).toBe(0);
		});
	});
});
