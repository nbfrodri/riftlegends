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
		fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
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
					expect(sideOf.get(victim)).toBeDefined();
					expect(sideOf.get(victim)).not.toBe(sideOf.get(killer));
					expect(killer).not.toBe(victim);
					expect(assists).not.toContain(victim);
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
		fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
			const setup = matchSetup({ seed });
			const { state, events } = playMatch(setup, MATCH_CONTESTS);
			const stats = playerStats(
				events,
				teamsOf(state),
				setup.match.rules,
				matchDuration(events.at(-1) as MatchEvent),
			);
			const kills = events.flatMap((e) => e.kills);
			for (const line of stats) {
				expect(line.kills).toBe(
					kills.filter((k) => k.killer === line.player).length,
				);
				expect(line.deaths).toBe(
					kills.filter((k) => k.victim === line.player).length,
				);
				expect(line.assists).toBe(
					kills.filter((k) => k.assists.includes(line.player)).length,
				);
			}
			for (const side of ["blue", "red"] as const) {
				const allies = Object.values(state.context[side].players);
				const scored = stats
					.filter((line) => allies.includes(line.player))
					.reduce((total, line) => total + line.kills, 0);
				const conceded = stats
					.filter((line) => !allies.includes(line.player))
					.reduce((total, line) => total + line.deaths, 0);
				expect(state[side].kills).toBe(scored);
				expect(scored).toBe(conceded);
			}
		}),
		{ numRuns: 40 },
	);
});

it("credits the rotating jungler in every gank", () => {
	for (let seed = 0; seed < 24; seed++) {
		const { state, events } = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
		for (const event of events.filter(
			(e) => e.kind === "gank" && e.kills.length > 0,
		)) {
			const jungler = state.context[event.side].players.jungle;
			expect(
				event.kills.some(
					(k) => k.killer === jungler || k.assists.includes(jungler),
				),
			).toBe(true);
		}
	}
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
