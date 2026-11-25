import { type MatchEvent, ROLES, type Side } from "@rift-legends/contracts";
import fc from "fast-check";
import { expect, it } from "vitest";
import { matchSetup } from "../fixtures/setup";
import { MATCH_CONTESTS, matchDuration, playMatch } from "../loop";
import { playerStats } from "../stats";

const teamsOf = (state: ReturnType<typeof playMatch>["state"]) => ({
	blue: {
		team: "forge",
		players: state.context.blue.players,
		champions: Object.fromEntries(ROLES.map((r) => [r, r])) as never,
		vision: Object.fromEntries(ROLES.map((r) => [r, 60])) as never,
	},
	red: {
		team: "shoal",
		players: state.context.red.players,
		champions: Object.fromEntries(ROLES.map((r) => [r, r])) as never,
		vision: Object.fromEntries(ROLES.map((r) => [r, 60])) as never,
	},
});

it("R1: every kill has a killer and its assistants on one side and a victim on the other", () => {
	fc.assert(
		fc.property(fc.integer({ min: 0, max: 5000 }), (seed) => {
			const { state, events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			const sideOf = new Map<string, Side>();
			for (const side of ["blue", "red"] as const) {
				for (const id of Object.values(state.context[side].players))
					sideOf.set(id, side);
			}
			for (const event of events) {
				const victims = new Set<string>();
				for (const { killer, victim, assists } of event.kills) {
					expect(sideOf.get(killer)).toBeDefined();
					expect(sideOf.get(victim)).not.toBe(sideOf.get(killer));
					expect(victims.has(victim)).toBe(false);
					victims.add(victim);
					expect(new Set(assists).size).toBe(assists.length);
					expect(assists).not.toContain(killer);
					for (const id of assists)
						expect(sideOf.get(id)).toBe(sideOf.get(killer));
				}
			}
		}),
		{ numRuns: 40 },
	);
});

it("R1: kills, deaths and assists of the stats add up to the facts of the events", () => {
	fc.assert(
		fc.property(fc.integer({ min: 0, max: 5000 }), (seed) => {
			const setup = matchSetup({ seed });
			const { state, events } = playMatch(setup, MATCH_CONTESTS);
			const stats = playerStats(
				events,
				teamsOf(state),
				setup.match.rules,
				matchDuration(events.at(-1) as MatchEvent),
			);
			const kills = events.flatMap((e) => e.kills);
			const sum = (key: "kills" | "deaths" | "assists") =>
				stats.reduce((total, line) => total + line[key], 0);
			expect(sum("kills")).toBe(kills.length);
			expect(sum("deaths")).toBe(kills.length);
			expect(sum("assists")).toBe(
				kills.reduce((n, k) => n + k.assists.length, 0),
			);
			expect(state.blue.kills + state.red.kills).toBe(kills.length);
		}),
		{ numRuns: 40 },
	);
});

it("R1: the support never beats the ADC on average in kills over many games", () => {
	const total = { bot: 0, support: 0 };
	for (let seed = 0; seed < 150; seed++) {
		const { state, events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
		const ids = [state.context.blue.players, state.context.red.players];
		for (const k of events.flatMap((e) => e.kills)) {
			for (const role of ["bot", "support"] as const) {
				if (ids.some((p) => p[role] === k.killer)) total[role]++;
			}
		}
	}
	expect(total.support).toBeLessThan(total.bot);
});
