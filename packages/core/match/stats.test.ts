import {
	decodeFact,
	draftFacts,
	encodeFact,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { farmed } from "./economy";

import { decisive } from "./explain";
import { fictionalMatchContent } from "./fixtures/content";
import { type Contest, LANE_CONTESTS, playMatch } from "./loop";
import { type EventFact, playerStats, type Teams } from "./stats";

const rules = fictionalMatchContent.rules;
const ids = (prefix: string) =>
	Object.fromEntries(ROLES.map((r) => [r, `${prefix}-${r}`])) as Record<
		Role,
		string
	>;
const visionOf = (value: number) =>
	Object.fromEntries(ROLES.map((r) => [r, value])) as Record<Role, number>;
const teams: Teams = {
	blue: {
		team: "forge",
		players: ids("b"),
		champions: ids("bc"),
		vision: visionOf(60),
	},
	red: {
		team: "shoal",
		players: ids("r"),
		champions: ids("rc"),
		vision: visionOf(60),
	},
};

const event = (change: Partial<EventFact>): EventFact => ({
	position: 1,
	game: 1,
	minute: 5,
	second: 0,
	kind: "lane",
	side: "blue",
	zone: "lane-mid",
	kills: [],
	gold: { blue: 0, red: 0 },
	chance: 5000,
	causes: [],
	...change,
});

/** Passive income by role after ten minutes with no tower lost. */
const tenMinutes = (passive: number) =>
	farmed(passive).map((gold) => gold * 10);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Random but coherent events: kills of the winner side, gold from the rules. */
const eventsArb = fc
	.array(
		fc.record({
			side: fc.constantFrom<Side>("blue", "red"),
			kind: fc.constantFrom<MatchEvent["kind"]>(
				"lane",
				"fight",
				"siege",
				"tower",
			),
			kills: fc.array(
				fc.record({
					killer: fc.constantFrom(...ROLES),
					victim: fc.constantFrom(...ROLES),
					assists: fc.uniqueArray(fc.constantFrom(...ROLES), { maxLength: 4 }),
				}),
				{ maxLength: 4 },
			),
			extra: fc.nat(1500),
			chance: fc.integer({ min: 0, max: 10000 }),
		}),
		{ maxLength: 30 },
	)
	.map((list) =>
		list.map(({ side, kind, kills, extra, chance }, i): EventFact => {
			const winners = teams[side];
			const losers = teams[side === "blue" ? "red" : "blue"];
			const fixed = kills.map((k) => ({
				killer: winners.players[k.killer],
				victim: losers.players[k.victim],
				assists: k.assists.map((a) => winners.players[a]),
			}));
			const earned =
				extra +
				sum(
					fixed.map(
						(k) => rules.economy.kill + rules.economy.assist * k.assists.length,
					),
				);
			return event({
				position: i + 1,
				side,
				kind,
				kills: fixed,
				chance,
				gold:
					side === "blue" ? { blue: earned, red: 0 } : { blue: 0, red: earned },
			});
		}),
	);

const total = (events: EventFact[], side: Side, minutes: number) =>
	rules.economy.passive * minutes + sum(events.map((e) => e.gold[side]));

/** Ends the game at minute 20 so lane contests alone can be tested. */
const finisher: Contest = {
	id: 99,
	due: (s) => s.minute === 20,
	resolve: () => [
		{
			kind: "nexus",
			side: "blue",
			zone: "base-red",
			second: 30,
			kills: [],
			gold: { blue: 0, red: 0 },
			chance: 10000,
			causes: [],
		},
	],
};

function playGame(seed: number) {
	const result = playMatch(
		{
			seed,
			game: 1,
			draft: fictionalContent,
			match: fictionalMatchContent,
			blue: {
				team: "forge",
				roles: {
					top: "cragbell",
					jungle: "duskroot",
					mid: "glasswake",
					bot: "copperfin",
					support: "bronzehook",
				},
			},
			red: {
				team: "shoal",
				roles: {
					top: "saltspire",
					jungle: "coalstride",
					mid: "waxblade",
					bot: "suncord",
					support: "shellward",
				},
			},
		},
		[...LANE_CONTESTS, finisher],
	);
	const { blue, red } = result.state.context;
	const champions = (players: Record<Role, string>) =>
		Object.fromEntries(ROLES.map((r) => [r, `c-${players[r]}`])) as Record<
			Role,
			string
		>;
	const real: Teams = {
		blue: {
			team: blue.team,
			players: blue.players,
			champions: champions(blue.players),
			vision: blue.vision,
		},
		red: {
			team: red.team,
			players: red.players,
			champions: champions(red.players),
			vision: red.vision,
		},
	};
	const events = result.events.map(
		(e, i): EventFact => ({ ...e, position: i + 1 }),
	);
	const last = events.at(-1);
	return {
		teams: real,
		events,
		duration: last ? (last.minute - 1) * 60 + last.second : 0,
	};
}

describe("M4 · gold and kills add up", () => {
	it("the gold of the five players is the gold of the side", () => {
		fc.assert(
			fc.property(
				eventsArb,
				fc.integer({ min: 1, max: 50 }),
				(events, mins) => {
					const stats = playerStats(events, teams, rules, mins * 60);
					const gold = (team: string) =>
						sum(stats.filter((p) => p.team === team).map((p) => p.gold));
					expect(gold("forge")).toBe(total(events, "blue", mins));
					expect(gold("shoal")).toBe(total(events, "red", mins));
				},
			),
		);
	});

	it("kills of one team are the deaths of the other, in real games", () => {
		for (const seed of [1, 2, 3, 4, 5, 6]) {
			const game = playGame(seed);
			const stats = playerStats(game.events, game.teams, rules, game.duration);
			const by = (team: string, key: "kills" | "deaths") =>
				sum(stats.filter((p) => p.team === team).map((p) => p[key]));
			expect(by("forge", "kills")).toBe(by("shoal", "deaths"));
			expect(by("shoal", "kills")).toBe(by("forge", "deaths"));
			const gold = (team: string, side: Side) =>
				sum(stats.filter((p) => p.team === team).map((p) => p.gold)) -
				total(game.events, side, 20);
			expect(gold("forge", "blue")).toBe(0);
			expect(gold("shoal", "red")).toBe(0);
		}
	});
});

describe("M5 · stats come from the facts", () => {
	const events = [
		event({
			position: 1,
			kills: [
				{ killer: "b-mid", victim: "r-mid", assists: ["b-jungle"] },
				{ killer: "b-mid", victim: "r-top", assists: [] },
			],
			gold: { blue: 2 * rules.economy.kill + rules.economy.assist, red: 0 },
		}),
		event({
			position: 2,
			side: "red",
			kills: [{ killer: "r-bot", victim: "b-mid", assists: ["r-support"] }],
			gold: { blue: 0, red: rules.economy.kill + rules.economy.assist },
		}),
	];
	const stats = playerStats(events, teams, rules, 600);
	const of = (player: string) => {
		const found = stats.find((p) => p.player === player);
		if (!found) throw new Error(player);
		return found;
	};

	it("counts K/D/A exactly", () => {
		expect(of("b-mid")).toMatchObject({ kills: 2, deaths: 1, assists: 0 });
		expect(of("b-jungle")).toMatchObject({ kills: 0, deaths: 0, assists: 1 });
		expect(of("r-bot")).toMatchObject({ kills: 1, deaths: 0, assists: 0 });
		expect(of("r-mid")).toMatchObject({ deaths: 1 });
	});

	it("pays kill and assist gold to who earned it", () => {
		const passive = tenMinutes(rules.economy.passive);
		expect(of("b-mid").gold).toBe(
			(passive[ROLES.indexOf("mid")] as number) + 2 * rules.economy.kill,
		);
		expect(of("b-jungle").gold).toBe(
			(passive[ROLES.indexOf("jungle")] as number) + rules.economy.assist,
		);
	});

	it("participation is kills plus assists over the team kills", () => {
		expect(of("b-mid").participation).toBe(10000);
		expect(of("b-jungle").participation).toBe(5000);
		expect(of("b-top").participation).toBe(0);
		expect(of("r-bot").participation).toBe(10000);
	});

	it("is zero when the team has no kills, never above 100 %", () => {
		const none = playerStats([], teams, rules, 600);
		expect(none.every((p) => p.participation === 0)).toBe(true);
		fc.assert(
			fc.property(eventsArb, (list) => {
				for (const p of playerStats(list, teams, rules, 900)) {
					expect(p.participation).toBeLessThanOrEqual(10000);
					expect(p.damage).toBeGreaterThanOrEqual(0);
					expect(Number.isInteger(p.damage)).toBe(true);
					expect(p.rating).toBeGreaterThanOrEqual(0);
					expect(p.rating).toBeLessThanOrEqual(100);
				}
			}),
		);
	});

	it("rates the one who carries above the one who dies, in the same role", () => {
		expect(of("b-mid").rating).toBeGreaterThan(of("r-mid").rating);
		expect(of("b-mid").rating).toBeGreaterThan(60);
		expect(of("r-mid").rating).toBeLessThan(60);
	});

	it("a game with no chances scores the neutral 60 where there is nothing to measure", () => {
		const quiet = playerStats([], teams, rules, 1800);
		// Jungle: no kills to join and no objectives (80 % neutral) and no deaths (100).
		expect(quiet.find((p) => p.player === "b-jungle")?.rating).toBe(68);
	});

	it("lists blue then red, in role order, with their champion", () => {
		expect(stats.map((p) => p.player)).toEqual([
			...ROLES.map((r) => `b-${r}`),
			...ROLES.map((r) => `r-${r}`),
		]);
		expect(of("r-bot")).toMatchObject({ team: "shoal", champion: "rc-bot" });
	});
});

describe("match.ended schema", () => {
	it("a real game passes the contract", () => {
		const game = playGame(7);
		const fact = {
			type: "match.ended" as const,
			position: 99,
			game: 1,
			winner: "forge",
			duration: game.duration,
			players: playerStats(game.events, game.teams, rules, game.duration),
			decisive: decisive(game.events, "blue"),
		};
		expect(decodeFact(draftFacts, encodeFact(fact))).toEqual(fact);
	});
});

describe("fights where both sides score", () => {
	const kill = (killer: string, victim: string, assists: string[] = []) => ({
		killer,
		victim,
		assists,
	});
	const { kill: k, assist: a } = rules.economy;
	const stats = playerStats(
		[
			event({
				position: 1,
				kind: "fight",
				side: "blue",
				kills: [
					kill("b-mid", "r-mid", ["b-jungle"]),
					kill("r-bot", "b-top", ["r-support"]),
				],
				gold: { blue: k + a, red: k + a },
			}),
		],
		teams,
		rules,
		600,
	);
	const of = (player: string) => stats.find((p) => p.player === player);

	it("credits each kill to the killer's team for participation", () => {
		expect(of("r-bot")?.participation).toBe(10000);
		expect(of("r-support")?.participation).toBe(10000);
		expect(of("b-mid")?.participation).toBe(10000);
	});

	it("pays the losing side's killers from that side's gold", () => {
		const farm = tenMinutes(rules.economy.passive);
		expect(of("r-bot")?.gold).toBe((farm[ROLES.indexOf("bot")] as number) + k);
		expect(of("b-mid")?.gold).toBe((farm[ROLES.indexOf("mid")] as number) + k);
	});
});

describe("V1 · vision score (#499)", () => {
	const line = (stats: ReturnType<typeof playerStats>, player: string) =>
		stats.find((p) => p.player === player) as (typeof stats)[number];
	const withVision = (blue: number): Teams => ({
		...teams,
		blue: { ...teams.blue, vision: visionOf(blue) },
	});
	const lane = [event({ kind: "lane", zone: "jungle-blue-top" })];

	it("more vision gives more vision score in every role, all else equal", () => {
		const low = playerStats(lane, withVision(40), rules, 1800);
		const high = playerStats(lane, withVision(80), rules, 1800);
		for (const role of ROLES) {
			const id = `b-${role}`;
			expect(line(high, id).vision, role).toBeGreaterThan(line(low, id).vision);
		}
		// The rival, with the same vision in both runs, does not move.
		expect(line(high, "r-support").vision).toBe(line(low, "r-support").vision);
	});

	it("the support scores far more than the lanes and the jungle more than them", () => {
		const stats = playerStats(lane, teams, rules, 1800);
		const of = (role: Role) => line(stats, `b-${role}`).vision;
		expect(of("support")).toBeGreaterThan(2 * of("jungle"));
		expect(of("jungle")).toBeGreaterThan(of("top"));
	});

	it("a longer game gives more vision score", () => {
		const short = playerStats(lane, teams, rules, 1500);
		const long = playerStats(lane, teams, rules, 2400);
		for (const role of ROLES)
			expect(line(long, `b-${role}`).vision).toBeGreaterThan(
				line(short, `b-${role}`).vision,
			);
	});

	it("is a deterministic non-negative integer", () => {
		fc.assert(
			fc.property(
				eventsArb,
				fc.integer({ min: 1, max: 50 }),
				fc.integer({ min: 0, max: 100 }),
				(events, mins, vision) => {
					const a = playerStats(events, withVision(vision), rules, mins * 60);
					const b = playerStats(events, withVision(vision), rules, mins * 60);
					expect(a).toEqual(b);
					for (const p of a) {
						expect(Number.isInteger(p.vision)).toBe(true);
						expect(p.vision).toBeGreaterThanOrEqual(0);
					}
				},
			),
		);
	});

	it("winning the contests of the jungle and pits adds vision score", () => {
		const won = [
			event({ kind: "gank", side: "blue", zone: "jungle-blue-top" }),
		];
		const lost = [
			event({ kind: "gank", side: "red", zone: "jungle-blue-top" }),
		];
		const a = playerStats(won, teams, rules, 1800);
		const b = playerStats(lost, teams, rules, 1800);
		expect(line(a, "b-support").vision).toBeGreaterThan(
			line(b, "b-support").vision,
		);
	});

	it("more vision gives a better rating to the support, all else equal", () => {
		const low = playerStats(lane, withVision(40), rules, 1800);
		const high = playerStats(lane, withVision(90), rules, 1800);
		expect(line(high, "b-support").rating).toBeGreaterThan(
			line(low, "b-support").rating,
		);
		// The lanes do not weigh vision: their rating does not change.
		expect(line(high, "b-mid").rating).toBe(line(low, "b-mid").rating);
	});
});
