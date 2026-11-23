import { expect, it } from "vitest";
import { SCALE } from "../math";
import type { Scored } from "./choose";
import { scenario } from "./fixtures/scenario";
import { lookahead } from "./lookahead";

const scored = (champion: string): Scored => ({
	champion,
	components: [{ key: "meta", points: 4 * SCALE }],
});

const glasswake = scored("glasswake");
const waxblade = scored("waxblade");
const adjustment = (points: number) => ({ key: "lookahead", points });

it("C5/E3 scores legal replies from the rival roster and explains each candidate independently", () => {
	const ctx = scenario({ picks: { forge: ["reedclaw"] } });
	const result = lookahead(ctx, [glasswake, waxblade], 1, (team, picks) => {
		expect(team).toBe("shoal");
		expect(picks.forge?.[0]).toBe("reedclaw");
		return ["silkflare", "waxblade"].filter((id) => !picks.forge?.includes(id));
	});

	// Shoal's main waxblade beats the higher tier silkflare. The former is
	// unavailable in the branch where Forge has already taken it.
	expect(result.replies).toEqual(
		new Map([
			["glasswake", { champion: "waxblade", points: -15_000 }],
			["waxblade", { champion: "silkflare", points: 0 }],
		]),
	);
	expect(result.candidates).toEqual([
		{
			...glasswake,
			components: [...glasswake.components, adjustment(-15_000)],
		},
		waxblade,
	]);
	expect(ctx.picks).toEqual({ forge: ["reedclaw"] });
});

it.each([
	{ value: -3, penalty: -15_000 },
	{ value: -2, penalty: 0 },
	{ value: 5, penalty: 0 },
])(
	"C5 halves a matchup of $value only below minus two",
	({ value, penalty }) => {
		const { content } = scenario();
		const ctx = scenario({
			content: {
				...content,
				matchups: [
					{ champion: "glasswake", against: "waxblade", role: "mid", value },
				],
			},
		});
		const result = lookahead(ctx, [glasswake], 1, () => ["waxblade"]);
		expect(result.replies.get("glasswake")).toEqual({
			champion: "waxblade",
			points: penalty,
		});
		expect(result.candidates[0]?.components).toEqual(
			penalty
				? [...glasswake.components, adjustment(penalty)]
				: glasswake.components,
		);
	},
);

it("C5 counts a counter recorded from the rival side only in a feasible lane", () => {
	const candidate = scored("cragbell");
	for (const [picks, expected] of [
		[{}, -25_000],
		[{ shoal: ["mosshelm"] }, 0],
	] as const) {
		const result = lookahead(scenario({ picks }), [candidate], 1, () => [
			"rimefoil",
		]);
		expect(result.replies.get("cragbell")).toEqual({
			champion: "rimefoil",
			points: expected,
		});
	}
});

it.each([
	{ step: 6, order: "first" }, // B1, then R1/R2 before B2.
	{ step: 7, order: "last" }, // R1, skip R2 before B2/B3 and R3.
	{ step: 10, order: "first" }, // B3, then R3, bans and R4 before B4.
	{ step: 11, order: "last" }, // R3, skip bans and R4 before B4/B5 and R5.
] as const)(
	"C5 follows both sides' next picks from step $step",
	({ step, order }) => {
		const { content } = scenario();
		const ctx = scenario({
			step,
			order,
			content: {
				...content,
				matchups: [
					{
						champion: "glasswake",
						against: "rimefoil",
						role: "mid",
						value: -6,
					},
					{ champion: "saltspire", against: "rimefoil", role: "top", value: 5 },
				],
			},
		});
		const result = lookahead(ctx, [glasswake], 2, (team, picks) => {
			expect(picks.forge).toEqual(["glasswake"]);
			if (team === "shoal") return ["rimefoil"];
			expect(picks.shoal).toEqual(["rimefoil"]);
			return ["quillforge", "saltspire"];
		});
		expect(result.candidates[0]?.components).toEqual([
			...glasswake.components,
			adjustment(-15_000),
		]);
		expect(result.replies.get("glasswake")).toEqual({
			champion: "rimefoil",
			points: -30_000,
		});
	},
);

it("C5 skips B5 after B4 and scores the rival as red on R5", () => {
	// R5 doubles waxblade's favorable matchup: it overtakes the higher tier main.
	const { content } = scenario();
	const ctx = scenario({
		step: 17,
		content: {
			...content,
			matchups: [
				{ champion: "waxblade", against: "glasswake", role: "mid", value: 3 },
			],
		},
	});
	const result = lookahead(ctx, [glasswake], 2, (team) => {
		expect(team).toBe("shoal");
		return ["suncord", "waxblade"];
	});
	expect(result.replies.get("glasswake")).toEqual({
		champion: "waxblade",
		points: -15_000,
	});
	expect(result.candidates[0]?.components).toEqual([
		...glasswake.components,
		adjustment(-15_000),
	]);
});

it.each([
	{ step: 6, order: "first", depth: 0 },
	{ step: 12, order: "last", depth: 2 },
	{ step: 19, order: "last", depth: 1 },
] as const)(
	"skips prediction at step $step with depth $depth",
	({ step, order, depth }) => {
		const result = lookahead(
			scenario({ step, order }),
			[glasswake],
			depth,
			() => {
				throw new Error("No future pick should be scored");
			},
		);
		expect(result).toEqual({ candidates: [glasswake], replies: new Map() });
	},
);

it("keeps the candidate when the rival has no available champion", () => {
	expect(lookahead(scenario(), [glasswake], 2, () => [])).toEqual({
		candidates: [glasswake],
		replies: new Map(),
	});
});

it("C5 scores our answer on R5 after the rival double pick", () => {
	const { content } = scenario();
	const ctx = scenario({
		order: "last",
		step: 11,
		content: {
			...content,
			matchups: [
				{ champion: "saltspire", against: "rimefoil", role: "top", value: 3 },
			],
		},
	});
	const result = lookahead(ctx, [glasswake], 2, (team) =>
		team === "shoal" ? ["rimefoil"] : ["suncord", "saltspire"],
	);
	expect(result.candidates[0]?.components).toEqual([
		...glasswake.components,
		adjustment(15_000),
	]);
});

it.each([
	{ answers: ["saltspire"], value: -6, bonus: -20_000 },
	{ answers: ["saltspire"], value: 0, bonus: 0 },
	{ answers: [], value: 5, bonus: 0 },
])(
	"C5 bounds the adjustment when our best available answer has value $value",
	({ answers, value, bonus }) => {
		const { content } = scenario();
		const ctx = scenario({
			content: {
				...content,
				matchups: [
					{ champion: "saltspire", against: "rimefoil", role: "top", value },
				],
			},
		});
		const result = lookahead(ctx, [glasswake], 2, (team) =>
			team === "shoal" ? ["rimefoil"] : answers,
		);
		expect(result.candidates[0]?.components).toEqual(
			bonus
				? [...glasswake.components, adjustment(bonus)]
				: glasswake.components,
		);
		expect(result.replies.get("glasswake")).toEqual({
			champion: "rimefoil",
			points: 0,
		});
	},
);
