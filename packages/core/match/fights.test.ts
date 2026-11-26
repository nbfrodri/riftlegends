import type { Side } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { edge } from "./contests/edge";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMinute } from "./loop";
import { createMatch, other } from "./state";

const ZONES = [
	"jungle-blue-top",
	"jungle-blue-bot",
	"jungle-red-top",
	"jungle-red-bot",
	"dragon-pit",
	"baron-pit",
];

it("starts fights in the mid game and credits and pays both teams' kills", () => {
	let fights = 0;
	let traded = 0;
	for (let seed = 0; seed < 16; seed++) {
		let state = createMatch(matchSetup({ seed }));
		const players = {
			blue: Object.values(state.context.blue.players),
			red: Object.values(state.context.red.players),
		};
		const { economy } = state.context.rules;
		for (let minute = 1; minute <= 26; minute++) {
			const next = playMinute(state, MATCH_CONTESTS);
			const credited = { blue: 0, red: 0 };
			for (const event of next.events) {
				const earned = { blue: 0, red: 0 };
				const kills = { blue: 0, red: 0 };
				for (const {
					killer,
					victim,
					assists,
					firstBlood,
					shutdown,
				} of event.kills) {
					const side: Side = players.blue.includes(killer) ? "blue" : "red";
					expect(players[side]).toContain(killer);
					expect(players[other(side)]).toContain(victim);
					for (const assist of assists) expect(players[side]).toContain(assist);
					kills[side]++;
					credited[side]++;
					earned[side] +=
						economy.kill +
						economy.assist +
						(firstBlood?.killerGold ?? 0) +
						(firstBlood?.assistGold ?? 0) +
						(shutdown ?? 0);
				}
				if (event.kind !== "fight") continue;
				fights++;
				// With players down a side may have a lone killer, never a lone fight.
				expect(event.kills.some((kill) => kill.assists.length > 0)).toBe(true);
				if (kills[other(event.side)] > 0) traded++;
				expect(minute).toBeGreaterThanOrEqual(14);
				expect(ZONES).toContain(event.zone);
				expect(kills[event.side]).toBeGreaterThan(kills[other(event.side)]);
				expect(new Set(event.kills.map((kill) => kill.victim)).size).toBe(
					event.kills.length,
				);
				expect(event.gold).toEqual(earned);
				expect(event.chance).toBeGreaterThan(0);
				expect(event.chance).toBeLessThan(10000);
				expect(event.causes.length).toBeGreaterThan(0);
				const siege = (offset: number) =>
					edge({ ...next.state, minute: minute + offset }, "siege");
				const points = siege(1).causes.find((cause) => cause.key === "fight");
				expect(
					(points?.points ?? 0) * (event.side === "blue" ? 1 : -1),
				).toBeGreaterThan(0);
				expect(siege(2).causes.some((cause) => cause.key === "fight")).toBe(
					false,
				);
			}
			for (const side of ["blue", "red"] as const) {
				expect(next.state[side].kills - state[side].kills).toBe(credited[side]);
			}
			state = next.state;
		}
	}
	expect(fights).toBeGreaterThan(0);
	expect(traded).toBeGreaterThan(0);
});

it("faster teams start more fights in the same minutes", () => {
	const count = (tempo: "slow" | "fast") => {
		const setup = matchSetup();
		const match = {
			...setup.match,
			teams: setup.match.teams.map((team) => ({
				...team,
				strategy: { ...team.strategy, tempo },
			})),
		};
		let fights = 0;
		for (let seed = 0; seed < 24; seed++) {
			let state = { ...createMatch(matchSetup({ seed, match })), minute: 13 };
			for (let minute = 14; minute <= 26; minute++) {
				const next = playMinute(state, MATCH_CONTESTS);
				fights += next.events.filter((event) => event.kind === "fight").length;
				state = next.state;
			}
		}
		return fights;
	};
	expect(count("fast")).toBeGreaterThan(count("slow"));
});
