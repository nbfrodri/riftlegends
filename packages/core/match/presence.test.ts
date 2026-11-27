import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { edge } from "./contests/edge";
import { LANE_CONTESTS } from "./contests/lane";
import { fictionalMatchContent } from "./fixtures/content";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { numbersPoints, presenceOf } from "./presence";
import { createMatch, type MatchState } from "./state";

const base = createMatch(matchSetup());
const { rules } = fictionalMatchContent;
const MINUTE = 20;
const AT = (MINUTE - 1) * 60;

/** `state` with `roles` of `side` down for the whole minute. */
const without = (
	state: MatchState,
	side: Side,
	roles: readonly Role[],
): MatchState => ({
	...state,
	[side]: {
		...state[side],
		players: {
			...state[side].players,
			...Object.fromEntries(
				roles.map((role) => [
					role,
					{ respawnAt: AT + 1000, diedAt: AT - 5, busyUntil: AT - 5 },
				]),
			),
		},
	},
});

const at20 = { ...base, minute: MINUTE };
const numbers = (state: MatchState, contest: Parameters<typeof edge>[1]) =>
	edge(state, contest, {}, "top", AT).causes.find((c) => c.key === "numbers")
		?.points ?? 0;

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const CONTESTS = ["lane", "jungle", "fight", "objective", "siege"] as const;

describe("the presence weights are rules (#529)", () => {
	it("sum 10,000 for every contest and lane", () => {
		const { presence } = rules;
		const tables = [
			presence.lane.top,
			presence.lane.mid,
			presence.lane.bot,
			presence.jungle,
			presence.fight,
			presence.objective,
			presence.siege,
		];
		for (const table of tables) {
			expect(ROLES.reduce((sum, role) => sum + table[role], 0)).toBe(10_000);
		}
	});

	it("count only the two laners in a lane", () => {
		const { lane } = rules.presence;
		expect(ROLES.filter((r) => lane.top[r] > 0)).toEqual(["top"]);
		expect(ROLES.filter((r) => lane.mid[r] > 0)).toEqual(["mid"]);
		expect(ROLES.filter((r) => lane.bot[r] > 0)).toEqual(["bot", "support"]);
	});

	it("presenceOf adds the weight of the roles that are up", () => {
		expect(presenceOf(rules.presence.fight, ROLES)).toBe(10_000);
		expect(presenceOf(rules.presence.fight, [])).toBe(0);
		expect(presenceOf(rules.presence.fight, ["bot"])).toBe(
			rules.presence.fight.bot,
		);
	});
});

describe("the cause numbers (#529)", () => {
	it("is absent with five against five", () => {
		for (const contest of CONTESTS) expect(numbers(at20, contest)).toBe(0);
	});

	it("follows the formula, in the points of the contest and against the side that lost a player", () => {
		for (const contest of CONTESTS) {
			const weights =
				contest === "lane" ? rules.presence.lane.top : rules.presence[contest];
			// The jungler is no part of a lane, so the top lane does not notice.
			const lost = contest === "lane" ? 0 : weights.jungle;
			const points = numbers(without(at20, "blue", ["jungle"]), contest);
			expect(points).toBe(numbersPoints(contest, 0, lost) + 0);
			if (contest !== "lane") expect(points).toBeLessThan(0);
		}
	});

	it("is mirrored when the other side is the short one", () => {
		const blue = numbers(without(at20, "blue", ["mid"]), "fight");
		const red = numbers(without(at20, "red", ["mid"]), "fight");
		expect(blue).toBeLessThan(0);
		expect(red).toBe(-blue);
	});

	it("weighs each role by contest: the jungle more at an objective than the top", () => {
		const jungle = numbers(without(at20, "blue", ["jungle"]), "objective");
		const top = numbers(without(at20, "blue", ["top"]), "objective");
		expect(jungle).toBeLessThan(top);
	});

	it("weighs the ADC more than the support in a fight", () => {
		const bot = numbers(without(at20, "blue", ["bot"]), "fight");
		const support = numbers(without(at20, "blue", ["support"]), "fight");
		expect(bot).toBeLessThan(support);
	});

	it("leaves the draft factors untouched", () => {
		const full = edge(at20, "fight", {}, undefined, AT).causes;
		const short = edge(
			without(at20, "blue", ["jungle", "bot"]),
			"fight",
			{},
			undefined,
			AT,
		).causes;
		for (const key of [
			"meta",
			"synergy",
			"matchup",
			"chemistry",
			"damage",
			"frontline",
			"cc",
			"peel",
		] as const) {
			expect(short.find((c) => c.key === key)?.points, key).toBe(
				full.find((c) => c.key === key)?.points,
			);
		}
	});

	it("takes the player attributes of the living only", () => {
		const jungler = (state: MatchState) =>
			edge(state, "jungle", {}, undefined, AT).causes.find(
				(c) => c.key === "jungler",
			)?.points ?? 0;
		expect(jungler(without(at20, "blue", ["jungle"]))).toBeLessThan(
			jungler(at20),
		);
		const roaming = (state: MatchState) =>
			edge(state, "jungle", {}, undefined, AT).causes.find(
				(c) => c.key === "roaming",
			)?.points ?? 0;
		expect(roaming(without(at20, "blue", ["jungle"]))).toBeLessThan(
			roaming(at20),
		);
	});
});

describe("D5 · monotonicity (#529)", () => {
	const roles = fc.subarray([...ROLES]);
	const contest = fc.constantFrom(
		...CONTESTS.map((name) => name),
	) as fc.Arbitrary<(typeof CONTESTS)[number]>;
	const lane = fc.constantFrom("top", "mid", "bot" as const);
	const chanceOf = (
		state: MatchState,
		name: (typeof CONTESTS)[number],
		laneName: "top" | "mid" | "bot",
	) => edge(state, name, {}, laneName, AT).blue;
	/** Both sides alike, so that inverting the sides inverts the chance. */
	const twins: MatchState = {
		...at20,
		red: { ...at20.blue },
		context: {
			...at20.context,
			red: at20.context.blue,
		},
	};

	it("one more player up on a side never lowers its chance", () => {
		fc.assert(
			fc.property(
				roles,
				roles,
				fc.constantFrom(...ROLES),
				contest,
				lane,
				fc.boolean(),
				(downBlue, downRed, extra, name, laneName, forBlue) => {
					const state = without(
						without(at20, "blue", downBlue),
						"red",
						downRed,
					);
					const side = forBlue ? "blue" : "red";
					const returned = without(
						state,
						side,
						(side === "blue" ? downBlue : downRed).filter((r) => r !== extra),
					);
					const before = chanceOf(state, name, laneName);
					const after = chanceOf(returned, name, laneName);
					if (forBlue) expect(after).toBeGreaterThanOrEqual(before);
					else expect(after).toBeLessThanOrEqual(before);
				},
			),
			{ numRuns: 400 },
		);
	});

	it("inverting the sides inverts the chance", () => {
		fc.assert(
			fc.property(roles, contest, lane, (down, name, laneName) => {
				const blue = chanceOf(without(twins, "blue", down), name, laneName);
				const red = chanceOf(without(twins, "red", down), name, laneName);
				expect(blue + red).toBe(10_000);
			}),
			{ numRuns: 200 },
		);
	});

	it("a side with nobody up loses without a roll, and 0 against 0 is even", () => {
		for (const name of CONTESTS) {
			const none = without(at20, "blue", ROLES);
			expect(chanceOf(none, name, "top")).toBe(0);
			expect(chanceOf(without(at20, "red", ROLES), name, "top")).toBe(10_000);
		}
		const nobody = without(without(at20, "blue", ROLES), "red", ROLES);
		expect(chanceOf(nobody, "fight", "top")).toBe(5000);
	});
});

describe("D6 · each contest counts the living by role (#529)", () => {
	const lane = (id: number) => LANE_CONTESTS.find((c) => c.id === id);
	const play = (state: MatchState, id: number) => {
		const rng = createRng(deriveSeed(7, SCOPES.match, 1, MINUTE, id));
		const second = int(rng, 0, 59);
		const events = lane(id)?.resolve(state, rng, second) ?? [];
		return { events, next: int(rng, 0, 9999) };
	};

	it("hands the lane to the rival, without a contest, when the laner is down", () => {
		for (const [id, laner] of [
			[1, "top"],
			[2, "mid"],
		] as const) {
			const { events } = play(without(at20, "blue", [laner]), id);
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({ side: "red", chance: 10_000 });
			expect(events[0]?.causes.some((c) => c.key === "numbers")).toBe(true);
			expect(events[0]?.kills).toEqual([]);
		}
	});

	it("still draws the roll it does not need", () => {
		const alive = play(at20, 1);
		const dead = play(without(at20, "blue", ["top"]), 1);
		expect(dead.next).toBe(alive.next);
	});

	it("has no contest when both laners are down", () => {
		const state = without(without(at20, "blue", ["mid"]), "red", ["mid"]);
		expect(play(state, 2).events).toEqual([]);
	});

	it("the bot lane is a contest while one of its two is up, and the rival's when both are down", () => {
		const one = play(without(at20, "blue", ["support"]), 3).events[0];
		expect(one?.causes.some((c) => c.key === "numbers")).toBe(true);
		const both = play(without(at20, "blue", ["bot", "support"]), 3).events[0];
		expect(both).toMatchObject({ side: "red", chance: 10_000 });
	});

	it("does not count the roles outside the lane", () => {
		const full = edge(at20, "lane", {}, "top", AT).blue;
		expect(
			edge(
				without(at20, "blue", ["jungle", "bot", "support", "mid"]),
				"lane",
				{},
				"top",
				AT,
			).blue,
		).toBe(full);
	});

	it("a gank with nobody up on a side still draws the winner and the lane", () => {
		const gank = MATCH_CONTESTS.find((c) => c.id === 4);
		const draw = (state: MatchState) => {
			const rng = createRng(deriveSeed(3, SCOPES.match, 1, MINUTE, 4));
			const second = int(rng, 0, 59);
			const events = gank?.resolve(state, rng, second) ?? [];
			return { events, next: int(rng, 0, 9999) };
		};
		const alive = draw(at20);
		const empty = draw(without(at20, "blue", ROLES));
		expect(empty.events[0]).toMatchObject({ side: "red", chance: 10_000 });
		expect(empty.next).toBe(alive.next);
	});
});

describe("the events say who was down (#529)", () => {
	it("lists the roles down per side, only when someone was", () => {
		let withDown = 0;
		for (let seed = 0; seed < 25; seed++) {
			const { events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			for (const event of events) {
				const missing = event.down
					? event.down.blue.length + event.down.red.length
					: 0;
				if (event.down) {
					expect(missing).toBeGreaterThan(0);
					withDown++;
				}
				const numbersCause = event.causes.find((c) => c.key === "numbers");
				if (numbersCause && numbersCause.points !== 0) {
					expect(event.down).toBeDefined();
				}
			}
		}
		expect(withDown).toBeGreaterThan(50);
	});

	it("gives the numbers cause to the side with more presence, seen from the winner", () => {
		let checked = 0;
		for (let seed = 0; seed < 40; seed++) {
			const { events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			for (const event of events) {
				if (event.kind !== "fight" || !event.down) continue;
				const weights = rules.presence.fight;
				const lost = (side: Side) =>
					(event.down?.[side] ?? []).reduce((sum, r) => sum + weights[r], 0);
				const other = event.side === "blue" ? "red" : "blue";
				const lead = lost(other) - lost(event.side);
				const points = event.causes.find((c) => c.key === "numbers")?.points;
				expect(sign(points ?? 0)).toBe(sign(lead));
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(10);
	});
});
