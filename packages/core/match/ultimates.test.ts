import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { min } from "../math";
import { edge } from "./contests/edge";
import { levelAt } from "./death-timer";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { gameSecond } from "./player-state";
import { numbersPoints, upAt, weightsOf } from "./presence";
import type { Contest } from "./profile";
import { createMatch, type MatchState } from "./state";
import {
	ESTIMATED_ULT,
	ultCooldown,
	ultimatesIn,
	ultKit,
	ultRank,
	ultStatus,
	windowBoost,
} from "./ultimates";

const MINUTE = 20;
const AT = gameSecond(MINUTE, 0);
const CONTESTS = ["lane", "jungle", "fight", "objective", "siege"] as const;
const base = createMatch(matchSetup());
const at20: MatchState = { ...base, minute: MINUTE };

/** `state` with the ultimates of `roles` of `side` ready again at `readyAt`. */
const cooling = (
	state: MatchState,
	side: Side,
	roles: readonly Role[],
	readyAt = AT + 60,
): MatchState => ({
	...state,
	[side]: {
		...state[side],
		players: {
			...state[side].players,
			...Object.fromEntries(
				roles.map((role) => [
					role,
					{ ...state[side].players[role], ultReadyAt: readyAt },
				]),
			),
		},
	},
});

/** `state` with `roles` of `side` dead for the whole minute. */
const dead = (state: MatchState, side: Side, roles: readonly Role[]) => ({
	...state,
	[side]: {
		...state[side],
		players: {
			...state[side].players,
			...Object.fromEntries(
				roles.map((role) => [
					role,
					{ ...state[side].players[role], respawnAt: AT + 1000 },
				]),
			),
		},
	},
});

const inContest = (state: MatchState, contest: Contest, at = AT) =>
	ultimatesIn(
		state,
		contest,
		weightsOf(state.context.rules, contest),
		upAt(state, at),
		at,
	);

describe("U1 · rank and cooldown of an ultimate (#339)", () => {
	it("is learned at level 6 and ranks up at 11 and 16", () => {
		expect([1, 5, 6, 10, 11, 15, 16, 18].map(ultRank)).toEqual([
			0, 0, 1, 1, 2, 2, 3, 3,
		]);
	});

	it("lasts the rank's base over 1 + haste, rounded half to even", () => {
		expect(ultCooldown([1200, 1000, 800], 1, 0)).toBe(120);
		expect(ultCooldown([1200, 1000, 800], 3, 0)).toBe(80);
		// Thresh and Malphite at rank 1 with 40 haste (plan 08).
		expect(ultCooldown([1200, 1000, 800], 1, 40)).toBe(86);
		expect(ultCooldown([1300, 1150, 1000], 1, 40)).toBe(93);
		expect(ultCooldown([1005, 1000, 800], 1, 0)).toBe(100);
		expect(ultCooldown([1015, 1000, 800], 1, 0)).toBe(102);
		// Teemo keeps the recharge of one charge: it is back at once.
		expect(ultCooldown([3, 3, 3], 1, 0)).toBe(0);
	});

	it("falls back to 120 / 100 / 80 s without game data, and knows engage and wombo carriers", () => {
		expect(ultKit(undefined)).toEqual({ tenths: ESTIMATED_ULT, key: false });
		expect(ESTIMATED_ULT).toEqual([1200, 1000, 800]);
		expect(
			ultKit({ archetypes: ["engage"], ultCooldownTenths: [1300, 1150, 1000] }),
		).toEqual({ tenths: [1300, 1150, 1000], key: true });
		expect(ultKit({ archetypes: ["carry"], kit: ["wombo"] }).key).toBe(true);
		expect(ultKit({ archetypes: ["carry"], kit: ["aoe"] }).key).toBe(false);
	});

	it("is locked before level 6, ready once learned and back on the second of its readyAt", () => {
		const early = { ...base, minute: 2 };
		expect(ultStatus(early, "blue", "mid", gameSecond(2, 0))).toBe("locked");
		expect(ultStatus(at20, "blue", "mid", AT)).toBe("ready");
		const used = cooling(at20, "blue", ["mid"], AT + 30);
		expect(ultStatus(used, "blue", "mid", AT + 29)).toBe("cooldown");
		expect(ultStatus(used, "blue", "mid", AT + 30)).toBe("ready");
	});
});

describe("U2 · more ultimates ready never lower a side's chance (#339)", () => {
	const roles = fc.subarray([...ROLES]);
	it("holds for every contest, cooldowns and deaths", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...CONTESTS),
				roles,
				roles,
				roles,
				fc.constantFrom(...ROLES),
				(contest, blueCooling, redCooling, blueDead, freed) => {
					const start = dead(
						cooling(cooling(at20, "red", redCooling), "blue", blueCooling),
						"blue",
						blueDead,
					);
					const ready = cooling(start, "blue", [freed], 0);
					const chance = (state: MatchState) =>
						edge(state, contest, {}, "bot", AT).blue;
					expect(chance(ready)).toBeGreaterThanOrEqual(chance(start));
				},
			),
		);
	});

	it("mirrors when the sides swap", () => {
		const mirror = createMatch(
			matchSetup({ red: { ...matchSetup().blue, team: "shoal" } }),
		);
		const cooled = ["mid", "top", "jungle"] as const;
		const state = cooling({ ...mirror, minute: MINUTE }, "red", cooled);
		const swapped = cooling({ ...mirror, minute: MINUTE }, "blue", cooled);
		expect(inContest(state, "fight").points).toBeGreaterThan(0);
		for (const contest of CONTESTS) {
			const points = inContest(state, contest).points;
			expect(points + inContest(swapped, contest).points).toBe(0);
		}
	});

	it("adds nothing in a contest where nobody is on cooldown and both sides are level", () => {
		const mirror = createMatch(
			matchSetup({ red: { ...matchSetup().blue, team: "shoal" } }),
		);
		expect(inContest({ ...mirror, minute: MINUTE }, "fight").points).toBe(0);
	});
});

describe("U4 · ultimates per side and their cap (#339)", () => {
	const { ult } = at20.context.rules.cooldowns;

	it("count up to three per side in a fight or objective and one in a lane, gank or siege", () => {
		const blueOnly = cooling(at20, "red", ROLES);
		expect(inContest(blueOnly, "fight").spent?.blue).toHaveLength(ult.team);
		expect(inContest(blueOnly, "objective").spent?.blue).toHaveLength(ult.team);
		for (const contest of ["jungle", "siege"] as const) {
			expect(inContest(blueOnly, contest).spent?.blue).toHaveLength(ult.local);
		}
	});

	it("put engage and wombo carriers first, then the role order", () => {
		// Forge's top (cragbell) and support (bronzehook) are engage champions.
		const spent = inContest(cooling(at20, "red", ROLES), "fight").spent?.blue;
		expect(spent?.map(({ role }) => role).slice(0, 2)).toEqual([
			"top",
			"support",
		]);
	});

	it("are worth less, all of them, than one player up more", () => {
		const blueOnly = cooling(at20, "red", ROLES);
		for (const contest of CONTESTS) {
			const weights = weightsOf(at20.context.rules, contest, "bot");
			const least = ROLES.map((role) => weights[role])
				.filter((w) => w > 0)
				.reduce((a, b) => min(a, b));
			const ults = ultimatesIn(
				blueOnly,
				contest,
				weights,
				upAt(blueOnly, AT),
				AT,
			);
			expect(ults.points).toBeLessThan(numbersPoints(contest, least, 0));
		}
	});
});

describe("U5 · only the players in a contest count and spend (#339)", () => {
	it("leaves out the dead and the ones with no weight", () => {
		const state = dead(cooling(at20, "red", ROLES), "blue", ["top", "support"]);
		const spent = inContest(state, "fight").spent?.blue.map(({ role }) => role);
		expect(spent).not.toContain("top");
		expect(spent).not.toContain("support");
		const lane = ultimatesIn(
			state,
			"lane",
			weightsOf(state.context.rules, "lane", "mid"),
			upAt(state, AT),
			AT,
		);
		expect(lane.spent?.blue.map(({ role }) => role)).toEqual(["mid"]);
	});

	it("lists who took part with the ultimate on cooldown", () => {
		const state = dead(cooling(at20, "blue", ["jungle", "mid"]), "blue", [
			"mid",
		]);
		expect(inContest(state, "fight").onCooldown).toEqual({
			blue: [{ role: "jungle", resource: "ult" }],
			red: [],
		});
	});

	it("sets readyAt from the rank and haste at the second of use", () => {
		const state = cooling(at20, "red", ROLES);
		const spent = inContest(state, "fight").spent?.blue ?? [];
		const { ultHaste } = state.context.rules;
		const haste = ultHaste[min(MINUTE - 1, ultHaste.length - 1)] as number;
		expect(spent.length).toBeGreaterThan(0);
		for (const { role, readyAt } of spent) {
			const rank = ultRank(levelAt(state.context.rules.levelCurve, role, AT));
			expect(rank).toBeGreaterThan(0);
			expect(readyAt).toBe(
				AT + ultCooldown(ESTIMATED_ULT, rank as 1 | 2 | 3, haste),
			);
		}
	});
});

describe("U3 · the window after the rival spends (#339)", () => {
	const { ult } = at20.context.rules.cooldowns;

	it("is 0 with the same ultimates ready and grows per ultimate of difference up to its cap", () => {
		expect(windowBoost(at20, AT)).toEqual({ blue: 0, red: 0 });
		expect(windowBoost(cooling(at20, "red", ["mid"]), AT)).toEqual({
			blue: ult.window,
			red: 0,
		});
		expect(windowBoost(cooling(at20, "blue", ROLES), AT)).toEqual({
			blue: 0,
			red: ult.windowCap,
		});
	});

	it("closes when the rival's ultimate is back", () => {
		const state = cooling(at20, "red", ["mid"], AT + 30);
		expect(windowBoost(state, AT + 30)).toEqual({ blue: 0, red: 0 });
	});

	it("opens no window for an ultimate still to learn", () => {
		const early = { ...base, minute: 2 };
		expect(
			windowBoost(cooling(early, "red", ["mid"]), gameSecond(2, 0)),
		).toEqual({ blue: 0, red: 0 });
	});
});

describe("C2 · a played game spends and recovers its ultimates (#339)", () => {
	const { events } = playMatch(matchSetup(), MATCH_CONTESTS);
	const when = (e: (typeof events)[number]) => gameSecond(e.minute, e.second);

	it("spends ultimates in contests", () => {
		expect(events.some((e) => e.spent)).toBe(true);
	});

	it("never spends an ultimate before it is back", () => {
		const back = new Map<string, number>();
		for (const event of events) {
			for (const side of ["blue", "red"] as const) {
				for (const { role, readyAt } of event.spent?.[side] ?? []) {
					const key = `${side}-${role}`;
					expect(when(event)).toBeGreaterThanOrEqual(back.get(key) ?? 0);
					expect(readyAt).toBeGreaterThanOrEqual(when(event));
					back.set(key, readyAt);
				}
			}
		}
	});
});

describe("C2 · each snapshot tells when every ultimate is back (#339)", () => {
	it("is the readyAt of the last spend up to that minute, from the facts alone", () => {
		const { state, events, snapshots } = playMatch(
			matchSetup({ seed: 7 }),
			MATCH_CONTESTS,
		);
		const id = (side: Side, role: Role) => state.context[side].players[role];
		for (const snapshot of snapshots) {
			const last = new Map<string, number>();
			for (const event of events) {
				if (event.minute > snapshot.minute) continue;
				for (const side of ["blue", "red"] as const) {
					for (const { role, readyAt } of event.spent?.[side] ?? []) {
						last.set(id(side, role), readyAt);
					}
				}
			}
			for (const p of snapshot.players) {
				expect(p.ultReadyAt, `minute ${snapshot.minute}`).toBe(
					last.get(p.player) ?? 0,
				);
			}
		}
	});
});
