import { type MatchEvent, ROLES, type Role } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Contest, ContestEvent } from "./contests/contest";
import { ASSIST_WINDOW } from "./contests/fights";
import { kill } from "./contests/lane";
import { levelAt, respawnTime } from "./death-timer";
import { farmed } from "./economy";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch, playMinute } from "./loop";
import { aliveRoles, gameSecond, isAlive } from "./player-state";
import { createMatch, type MatchState } from "./state";
import { trackPlayerStats } from "./stats";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const base = createMatch(matchSetup());
const { rules } = base.context;

/** Who is who in a game: side and role of each player id. */
const rolesOf = (state: MatchState) =>
	new Map(
		(["blue", "red"] as const).flatMap((side) =>
			ROLES.map(
				(role) => [state.context[side].players[role], { side, role }] as const,
			),
		),
	);

/** Second of the game of a kill: its event plus its place in the fight. */
const killSecond = (event: MatchEvent, fightSecond?: number) =>
	gameSecond(event.minute, event.second) + (fightSecond ?? 0);

describe("D2 · every kill sets when the victim comes back (#528)", () => {
	it("is the wiki formula at the victim's level and second of death", () => {
		let kills = 0;
		for (const seed of SEEDS) {
			const { state, events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			const roles = rolesOf(state);
			for (const event of events) {
				for (const k of event.kills) {
					const role = roles.get(k.victim)?.role as Role;
					const at = killSecond(event, k.fightSecond);
					const level = levelAt(rules.levelCurve, role, at);
					expect(k.respawnAt).toBe(respawnTime(rules.deathTimer, level, at));
					kills++;
				}
			}
		}
		expect(kills).toBeGreaterThan(100);
	});

	it("is alive when the second arrives, and not a second before", () => {
		const dead: MatchState = {
			...base,
			blue: {
				...base.blue,
				players: {
					...base.blue.players,
					mid: { respawnAt: 100, diedAt: 40, busyUntil: 40 },
				},
			},
		};
		expect(isAlive(dead, "blue", "mid", 99)).toBe(false);
		expect(isAlive(dead, "blue", "mid", 100)).toBe(true);
		expect(isAlive(dead, "red", "mid", 99)).toBe(true);
		expect(aliveRoles(dead, "blue", 99)).toEqual(
			ROLES.filter((role) => role !== "mid"),
		);
		expect(aliveRoles(base, "blue", 0)).toEqual([...ROLES]);
	});

	it("everyone is alive at the start of the game", () => {
		for (const side of ["blue", "red"] as const) {
			for (const role of ROLES) {
				expect(base[side].players[role].respawnAt).toBe(0);
			}
		}
	});
});

describe("D3 · victims, killers and assistants are always alive (#528)", () => {
	it("holds over many games, rebuilt from the facts alone", () => {
		let checked = 0;
		for (const seed of SEEDS) {
			const { events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			// The span each player is down: from the death to the return.
			const down = new Map<string, [number, number][]>();
			const isDown = (player: string, at: number) =>
				(down.get(player) ?? []).some(([from, to]) => from <= at && at < to);
			for (const event of events) {
				for (const k of event.kills) {
					const at = killSecond(event, k.fightSecond);
					for (const who of [k.killer, k.victim]) {
						expect(isDown(who, at), `seed ${seed}, ${who} at ${at}`).toBe(
							false,
						);
					}
					// An assistant who died up to ASSIST_WINDOW seconds ago still assists.
					for (const who of k.assists) {
						expect(
							isDown(who, at) && isDown(who, at - ASSIST_WINDOW - 1),
							`seed ${seed}, ${who} at ${at}`,
						).toBe(false);
					}
					down.set(k.victim, [
						...(down.get(k.victim) ?? []),
						[at, k.respawnAt as number],
					]);
					checked++;
				}
			}
		}
		expect(checked).toBeGreaterThan(100);
	});
});

describe("D4 · contests of a minute resolve in (second, id) order (#528)", () => {
	const SEED = 42;
	const minute = 3;
	/** The first draw of a contest's own stream is its second. */
	const secondOf = (id: number) =>
		int(createRng(deriveSeed(SEED, SCOPES.match, 1, minute, id)), 0, 59);
	const ids = Array.from({ length: 12 }, (_, i) => 300 + i);

	const killer = (id: number, log: string[]): Contest => ({
		id,
		due: () => true,
		resolve(state, _rng, second) {
			log.push(`${id}@${second}`);
			const seen = state.red.players.top.respawnAt;
			log.push(`${id} sees top ${seen > 0 ? "dead" : "alive"}`);
			const event: ContestEvent = {
				kind: "gank",
				side: "blue",
				zone: "lane-top",
				second: second,
				kills: [kill(state, "blue", "jungle", "top", [])],
				gold: { blue: 100, red: 0 },
				chance: 5000,
				causes: [],
			};
			return id === ids[0] ? [event] : [];
		},
	});

	it("draws each second first from the contest's own stream", () => {
		const log: string[] = [];
		const contests = ids.map((id) => killer(id, log));
		const state = {
			...createMatch(matchSetup({ seed: SEED })),
			minute: minute - 1,
		};
		playMinute(state, contests);
		for (const id of ids) expect(log).toContain(`${id}@${secondOf(id)}`);
	});

	it("resolves in second order, ties by id", () => {
		const log: string[] = [];
		const state = {
			...createMatch(matchSetup({ seed: SEED })),
			minute: minute - 1,
		};
		playMinute(
			state,
			ids.map((id) => killer(id, log)),
		);
		const order = log
			.filter((line) => line.includes("@"))
			.map((line) => Number(line.split("@")[0]));
		const expected = [...ids].sort(
			(a, b) => secondOf(a) - secondOf(b) || a - b,
		);
		expect(order).toEqual(expected);
	});

	it("each contest sees the deaths of the ones before it", () => {
		const log: string[] = [];
		const state = {
			...createMatch(matchSetup({ seed: SEED })),
			minute: minute - 1,
		};
		playMinute(
			state,
			ids.map((id) => killer(id, log)),
		);
		const killerSecond = secondOf(ids[0] as number);
		for (const id of ids.slice(1)) {
			const after =
				secondOf(id) > killerSecond ||
				(secondOf(id) === killerSecond && id > (ids[0] as number));
			expect(log).toContain(`${id} sees top ${after ? "dead" : "alive"}`);
		}
	});
});

describe("a dead player loses the passive gold of the time he is down (#528)", () => {
	const fight: Contest = {
		id: 100,
		due: () => true,
		resolve: () => [
			{
				kind: "gank",
				side: "blue",
				zone: "lane-top",
				second: 0,
				kills: [kill(base, "blue", "jungle", "top", [])],
				gold: { blue: 0, red: 0 },
				chance: 5000,
				causes: [],
			},
		],
	};

	it("takes the proportional part from the victim and the team", () => {
		const { state, events } = playMinute(base, [fight]);
		const respawn = events[0]?.kills[0]?.respawnAt as number;
		// Minute 1, second 0, level 1: 10 s down.
		expect(respawn).toBe(10);
		const income = rules.economy.passive;
		const farm = farmed(income);
		const top = farm[ROLES.indexOf("top")] as number;
		const lost = (top * 10 - ((top * 10) % 60)) / 60;
		expect(lost).toBeGreaterThan(0);
		expect(state.red.paid[ROLES.indexOf("top")]).toBe(top - lost);
		expect(state.red.gold).toBe(income - lost);
		expect(state.blue.gold).toBe(income + (events[0]?.gold.blue ?? 0));
	});

	it("the stats rebuilt from the facts agree with the state", () => {
		const { state, events } = playMinute(base, [fight]);
		const stats = trackPlayerStats(base.context, rules);
		for (const event of events) stats.record(event);
		const gold = stats.at(1, ({ side, role }, _line, gold) => ({
			side,
			role,
			gold,
		}));
		for (const { side, role, gold: got } of gold) {
			expect(got).toBe(state[side].paid[ROLES.indexOf(role)]);
		}
	});
});

describe("D10 · the facts reproduce each player's state (#528)", () => {
	it("every snapshot lists the second each player comes back", () => {
		for (const seed of SEEDS.slice(0, 12)) {
			const { state, events, snapshots } = playMatch(
				matchSetup({ seed }),
				MATCH_CONTESTS,
			);
			for (const snapshot of snapshots) {
				const last = new Map<string, number>();
				for (const event of events) {
					if (event.minute > snapshot.minute) continue;
					for (const k of event.kills)
						last.set(k.victim, k.respawnAt as number);
				}
				for (const p of snapshot.players) {
					expect(p.respawnAt, `seed ${seed} minute ${snapshot.minute}`).toBe(
						last.get(p.player) ?? 0,
					);
				}
			}
			const roles = rolesOf(state);
			for (const [id, { side, role }] of roles) {
				const final = snapshots.at(-1)?.players.find((p) => p.player === id);
				expect(final?.respawnAt).toBe(state[side].players[role].respawnAt);
			}
		}
	});
});
