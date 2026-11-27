import {
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { rules as content } from "../content/data";
import { createRng } from "../rng/streams";
import { stepWindow } from "./contests/conversion";
import { STRUCTURE_CONTESTS } from "./contests/structures";
import type { ConversionWindow } from "./conversion-window";

const { cost: COST, delay: WINDOW_DELAY } = content.conversion;

import { levelAt, respawnTime } from "./death-timer";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMinute } from "./loop";
import { gameSecond, startPlayers } from "./player-state";
import { applyEvents, createMatch, type MatchState, other } from "./state";

const base = createMatch(matchSetup());
const { rules } = base.context;
const NEVER = { grub: 999, dragon: 999, herald: 999, baron: 999, elder: 999 };

/** A fight won by `side`; each kill of the loser is `[role, fightSecond, respawnAt]`. */
function fight(
	state: MatchState,
	side: Side,
	minute: number,
	second: number,
	lost: Record<Side, [Role, number, number][]>,
): MatchEvent {
	const kills = (["blue", "red"] as const).flatMap((victimSide) =>
		lost[victimSide].map(([role, fightSecond, respawnAt]) => ({
			killer: state.context[other(victimSide)].players[ROLES[0] as Role],
			victim: state.context[victimSide].players[role],
			assists: [],
			fightSecond,
			respawnAt,
		})),
	);
	return {
		game: 1,
		minute,
		second,
		kind: "fight",
		side,
		zone: "dragon-pit",
		kills,
		gold: { blue: 0, red: 0 },
		chance: 5000,
		causes: [],
	};
}

const at = (minute: number, second: number) => gameSecond(minute, second);

/** The state with the rival of the window down until it ends, as a won fight leaves it. */
const dead = (state: MatchState): MatchState => {
	const { window } = state;
	if (!window) return state;
	const loser = other(window.side);
	return {
		...state,
		[loser]: {
			...state[loser],
			players: Object.fromEntries(
				ROLES.map((role) => [
					role,
					{ respawnAt: window.until, diedAt: 0, busyUntil: 0 },
				]),
			) as typeof state.red.players,
		},
	};
};

/** The window a fight leaves, through the state that applies it. */
const windowOf = (event: MatchEvent) =>
	applyEvents({ ...base, minute: event.minute - 1 }, [event]).window;

describe("D7 · the window after a fight won in numbers (#530)", () => {
	it("opens 15 s after the last kill and lasts until the rival has as many up", () => {
		const start = at(20, 20);
		const event = fight(base, "blue", 20, 20, {
			blue: [],
			red: [
				["top", 0, start + 90],
				["mid", 5, start + 95],
				["bot", 9, start + 99],
			],
		});
		expect(windowOf(event)).toEqual({
			side: "blue",
			at: start + 9 + WINDOW_DELAY,
			until: start + 99,
			lead: 3,
			started: false,
		});
	});

	it("does not open when the winner is not up more players than the loser", () => {
		const start = at(20, 20);
		const even = fight(base, "blue", 20, 20, {
			blue: [["top", 0, start + 60]],
			red: [["mid", 3, start + 60]],
		});
		expect(windowOf(even)).toBeNull();
		const behind = fight(base, "blue", 20, 20, {
			blue: [
				["top", 0, start + 60],
				["mid", 1, start + 60],
			],
			red: [["bot", 3, start + 60]],
		});
		expect(windowOf(behind)).toBeNull();
	});

	it("counts the winner's own dead: the lead is what is left over", () => {
		const start = at(30, 10);
		const event = fight(base, "red", 30, 10, {
			red: [["jungle", 0, start + 70]],
			blue: [
				["top", 2, start + 80],
				["mid", 4, start + 84],
			],
		});
		expect(windowOf(event)).toMatchObject({ side: "red", lead: 1 });
	});

	it("ends when a rival comes back and the sides are level, even if a winner is still down", () => {
		const start = at(30, 10);
		const event = fight(base, "blue", 30, 10, {
			blue: [["top", 0, start + 200]],
			red: [
				["mid", 2, start + 40],
				["bot", 4, start + 50],
			],
		});
		// Blue 4 against red 3; at +40 red is 4 against 4.
		expect(windowOf(event)?.until).toBe(start + 40);
	});

	it("keeps the lead of a winner whose dead come back before the rival's", () => {
		const start = at(30, 10);
		const event = fight(base, "blue", 30, 10, {
			blue: [["top", 0, start + 30]],
			red: [
				["mid", 2, start + 80],
				["bot", 4, start + 90],
			],
		});
		// Blue is 5 against 3 from +30; level only at +90.
		expect(windowOf(event)?.until).toBe(start + 90);
	});

	it("takes the first objective or structure of the winner and spends its time", () => {
		const open: ConversionWindow = {
			side: "blue",
			at: at(30, 5),
			until: at(30, 5) + 400,
			lead: 5,
			started: false,
		};
		const state: MatchState = {
			...base,
			minute: 30,
			objectives: NEVER,
			window: open,
		};
		const { events, window } = stepWindow(dead(state), createRng(1));
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			kind: "tower",
			tier: 1,
			side: "blue",
			second: 5,
		});
		expect(window).toMatchObject({ at: open.at + COST.tower, started: true });
	});

	it("goes for a baron that is up before the towers", () => {
		const open: ConversionWindow = {
			side: "blue",
			at: at(30, 5),
			until: at(30, 5) + 400,
			lead: 5,
			started: false,
		};
		const state: MatchState = {
			...base,
			minute: 30,
			objectives: { ...NEVER, baron: 20 },
			window: open,
		};
		const { events } = stepWindow(dead(state), createRng(1));
		expect(events[0]).toMatchObject({
			kind: "baron",
			side: "blue",
			zone: "baron-pit",
		});
	});

	it("ends with no events when the game is over", () => {
		const state: MatchState = {
			...base,
			minute: 30,
			winner: "blue",
			window: {
				side: "blue",
				at: at(30, 5),
				until: at(30, 5) + 400,
				lead: 5,
				started: false,
			},
		};
		expect(stepWindow(dead(state), createRng(1))).toEqual({
			events: [],
			window: null,
		});
	});

	it("crosses the minute: what does not fit continues in the next one", () => {
		const open: ConversionWindow = {
			side: "blue",
			at: at(31, 10),
			until: at(31, 10) + COST.tower + 1,
			lead: 5,
			started: false,
		};
		const state: MatchState = {
			...base,
			minute: 30,
			objectives: NEVER,
			window: open,
		};
		const next = playMinute(dead(state), []);
		expect(next.events.map((e) => [e.minute, e.kind, e.second])).toEqual([
			[31, "tower", 10],
			[31, "tower", 10 + COST.tower],
		]);
		expect(next.state.window).toBeNull();
	});

	it("keeps the rest of a window that runs past the end of the minute", () => {
		const open: ConversionWindow = {
			side: "blue",
			at: at(31, 50),
			until: at(31, 50) + 100,
			lead: 5,
			started: false,
		};
		const state: MatchState = {
			...base,
			minute: 30,
			objectives: NEVER,
			window: open,
		};
		const first = playMinute(dead(state), []);
		expect(first.events).toHaveLength(1);
		expect(first.state.window?.at).toBeGreaterThanOrEqual(at(32, 0));
		const second = playMinute(first.state, []);
		expect(second.events[0]?.minute).toBe(32);
		expect(second.events[0]?.second).toBe(
			(first.state.window?.at ?? 0) - at(32, 0),
		);
	});

	it("uses its own stream: the other contests of the minute draw the same", () => {
		let state = createMatch(matchSetup({ seed: 7 }));
		for (let minute = 1; minute <= 18; minute++) {
			state = playMinute(state, MATCH_CONTESTS).state;
		}
		const open: ConversionWindow = {
			side: "red",
			at: at(19, 40),
			until: at(19, 40) + 80,
			lead: 3,
			started: false,
		};
		const without = playMinute({ ...state, window: null }, MATCH_CONTESTS);
		const withWindow = playMinute({ ...state, window: open }, MATCH_CONTESTS);
		const kept = (events: MatchEvent[]) =>
			events.filter((e) => e.kind === "fight");
		expect(kept(withWindow.events)).toEqual(kept(without.events));
	});
});

/** Red has lost every tower and an inhibitor: its base is open. */
const openBase = (state: MatchState, minute: number): MatchState => ({
	...state,
	minute,
	objectives: NEVER,
	red: {
		...state.red,
		towers: { top: 3, mid: 3, bot: 3 },
		inhibitors: { top: minute + 4, mid: 0, bot: 0 },
	},
});

/** Plays the window out, minute by minute, and lists what it took. */
function chain(state: MatchState) {
	let current = dead(state);
	const kinds: string[] = [];
	for (let i = 0; i < 4 && current.window && current.winner === null; i++) {
		const next = playMinute(current, []);
		kinds.push(...next.events.map((e) => e.kind));
		current = next.state;
	}
	return { kinds, state: current };
}

describe("D8 · closing the game after an ace (#530)", () => {
	const ace = (minute: number, seconds = [0, 3, 6, 9, 12]) => {
		const second = 20;
		const lost = ROLES.map((role, i) => {
			const died = gameSecond(minute, second) + (seconds[i] as number);
			const level = levelAt(rules.levelCurve, role, died);
			return [role, seconds[i], respawnTime(rules.deathTimer, level, died)] as [
				Role,
				number,
				number,
			];
		});
		return fight(base, "blue", minute, second, { blue: [], red: lost });
	};

	it("takes the nexus towers and the nexus in the same window when the base is open", () => {
		const state = openBase(base, 29);
		const long: ConversionWindow = {
			side: "blue",
			at: at(30, 0),
			until: at(30, 0) + 300,
			lead: 5,
			started: false,
		};
		const { kinds, state: end } = chain({ ...state, window: long });
		expect(kinds).toEqual(["tower", "tower", "nexus"]);
		expect(end.winner).toBe("blue");
	});

	it("cannot take the nexus while no inhibitor is down", () => {
		const closed = {
			...openBase(base, 29),
			red: {
				...openBase(base, 29).red,
				inhibitors: { top: 0, mid: 0, bot: 0 },
			},
		};
		const long: ConversionWindow = {
			side: "blue",
			at: at(30, 0),
			until: at(30, 0) + 300,
			lead: 5,
			started: false,
		};
		const { kinds, state: end } = chain({ ...closed, window: long });
		expect(kinds).toContain("inhibitor");
		expect(kinds.indexOf("inhibitor")).toBeLessThan(kinds.indexOf("nexus"));
		expect(end.winner).toBe("blue");
		const short = chain({
			...closed,
			window: { ...long, until: at(30, 0) + COST.inhibitor },
		});
		expect(short.kinds).toEqual(["inhibitor"]);
	});

	it("needs time: a short window takes less than the whole chain", () => {
		const open = openBase(base, 29);
		const short: ConversionWindow = {
			side: "blue",
			at: at(30, 0),
			until: at(30, 0) + COST.tower + 1,
			lead: 5,
			started: false,
		};
		expect(chain({ ...open, window: short }).kinds).toEqual(["tower", "tower"]);
	});

	it("an ace at minute 15 leaves a shorter window than one at minute 40", () => {
		const early = windowOf(ace(15)) as ConversionWindow;
		const late = windowOf(ace(40)) as ConversionWindow;
		expect(early.lead).toBe(5);
		expect(late.until - late.at).toBeGreaterThan(early.until - early.at);
		const run = (minute: number, window: ConversionWindow) =>
			chain({ ...openBase(base, minute - 1), window }).kinds;
		expect(run(15, early).length).toBeGreaterThan(0);
		expect(run(40, late).length).toBeGreaterThan(run(15, early).length);
		expect(run(40, late)).toContain("nexus");
		expect(run(15, early)).not.toContain("nexus");
	});

	it("the nexus falls only in a window: a won push never takes it", () => {
		const state: MatchState = {
			...openBase(base, 29),
			red: { ...openBase(base, 29).red, nexusTowers: 2 },
		};
		let took = 0;
		for (let seed = 1; seed <= 60; seed++) {
			const s = createMatch(matchSetup({ seed }));
			const open: MatchState = {
				...state,
				context: s.context,
				blue: { ...state.blue, players: startPlayers() },
			};
			const { events } = playMinute(open, STRUCTURE_CONTESTS);
			took += events.filter((e) => e.kind === "nexus").length;
		}
		expect(took).toBe(0);
	});
});
