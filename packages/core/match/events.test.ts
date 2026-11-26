import { type MatchEvent, ROLES } from "@rift-legends/contracts";
import fc from "fast-check";
import { expect, test } from "vitest";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { Contest, ContestEvent } from "./contests/contest";
import { edge } from "./contests/edge";
import { kill } from "./contests/lane";
import { paidByRole } from "./economy";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch, playMinute } from "./loop";
import { createMatch } from "./state";

type Kill = MatchEvent["kills"][number];

const base = createMatch(matchSetup());
const rules = base.context.rules.economy;
const blueKill = (assists: readonly ["jungle", "support"] | [] = []) =>
	kill(base, "blue", "top", "top", assists);
const redKill = kill(base, "red", "top", "top", []);
const event = (
	kills: Kill[],
	options: Partial<ContestEvent> = {},
): ContestEvent => ({
	kind: "fight",
	zone: "baron-pit",
	side: "blue",
	second: 0,
	chance: 5000,
	causes: [],
	gold: {
		blue: rules.kill + (kills[0]?.assists.length ? rules.assist : 0),
		red: 0,
	},
	kills,
	...options,
});
const contest = (e: ContestEvent, id = 100): Contest => ({
	id,
	due: () => true,
	resolve: () => [e],
});

/** Contests resolve by the second of their own stream (plan 08, #528). */
const resolvesFirst = (ids: readonly number[]) =>
	[...ids].sort((a, b) => secondOf(a) - secondOf(b) || a - b) as [
		number,
		number,
	];
const secondOf = (id: number) =>
	int(createRng(deriveSeed(42, SCOPES.match, 1, 1, id)), 0, 59);

test("first blood pays the killer and a single shared extra assist bag", () => {
	const [early, late] = resolvesFirst([100, 101]);
	const {
		events: [first, second],
		state,
	} = playMinute(base, [
		contest(event([blueKill()], { second: 30 }), late),
		contest(event([blueKill(["jungle", "support"])], { second: 10 }), early),
	]);
	expect(first?.kills[0]).toMatchObject({
		firstBlood: { killerGold: 100, assistGold: 50 },
	});
	expect(second?.kills[0]).not.toHaveProperty("firstBlood");
	expect(first?.gold.blue).toBe(rules.kill + rules.assist + 150);
	if (!first) throw new Error("missing first contest");
	expect(paidByRole(first, base.context.slots, rules).blue).toEqual([
		rules.kill + 100,
		(rules.assist + 50) / 2,
		0,
		0,
		(rules.assist + 50) / 2,
	]);
	expect(state.blue.gold).toBe(
		rules.passive + (first.gold.blue + (second?.gold.blue ?? 0)),
	);
});

test("shutdown gold grows with a surviving spree and resets on death", () => {
	fc.assert(
		fc.property(fc.integer({ min: 1, max: 12 }), (length) => {
			let state = base;
			for (let count = 1; count <= length; count++) {
				const step = playMinute(state, [contest(event([blueKill()]))]);
				if (count >= 3 && count <= 8)
					expect(step.events[0]?.kills[0]).toHaveProperty("spree", count);
				state = step.state;
			}
			if (length >= 3) {
				const causes = edge(state, "fight").causes;
				expect(
					causes.find(({ key }) => key === "killingSpree")?.points,
				).toBeGreaterThan(0);
				expect(
					causes.find(({ key }) => key === "shutdownRisk")?.points,
				).toBeLessThan(0);
			}
			const counter = contest(
				event([redKill], {
					side: "red",
					gold: { blue: 0, red: rules.kill },
				}),
			);
			const {
				state: ended,
				events: [shutdown],
			} = playMinute(state, [counter]);
			if (!shutdown) throw new Error("missing counterkill");
			const bounty =
				[0, 0, 150, 300, 400, 500, 600, 700][(length < 8 ? length : 8) - 1] ??
				0;
			if (bounty) expect(shutdown.kills[0]).toHaveProperty("shutdown", bounty);
			else expect(shutdown.kills[0]).not.toHaveProperty("shutdown");
			expect(shutdown.gold.red).toBe(rules.kill + bounty);
			expect(paidByRole(shutdown, base.context.slots, rules).red).toEqual([
				rules.kill + bounty,
				0,
				0,
				0,
				0,
			]);
			expect(
				playMinute(ended, [counter]).events[0]?.kills[0],
			).not.toHaveProperty("shutdown");
		}),
	);
});

test("an ace requires five distinct dead opponents in the same exchange and marks the last casualty by second", () => {
	fc.assert(
		fc.property(
			fc.shuffledSubarray([...ROLES], { minLength: 1 }),
			fc.boolean(),
			(victims, returns) => {
				const deaths = victims.map((victim, i) => ({
					...kill(base, "blue", "top", victim, []),
					fightSecond: 2 * i,
				}));
				const opening = victims[0];
				if (returns && opening && victims.length > 1)
					deaths.splice(1, 0, {
						...kill(base, "red", opening, "mid", []),
						fightSecond: 1,
					});
				const [{ kills } = { kills: [] }] = playMinute(base, [
					contest(event(deaths.reverse())),
				]).events;
				const aces = kills.filter((casualty) => "ace" in casualty);
				expect(aces).toHaveLength(victims.length === 5 && !returns ? 1 : 0);
				if (aces.length) expect(aces[0]?.fightSecond).toBe(8);
			},
		),
	);
});

test("solo kills pay extra lane gold and give experience pressure only in the winning lane", () => {
	const duel = event([blueKill()], { kind: "lane", zone: "lane-top" });
	const solo = playMinute(base, [
		contest(duel),
		contest(
			event([blueKill()], { kind: "gank", zone: "lane-top", second: 10 }),
			101,
		),
	]);
	expect(solo.events[0]?.kills[0]).toHaveProperty("soloKill", true);
	expect(solo.events[0]?.gold.blue).toBe(rules.kill + 100 + 50);
	expect(solo.events[1]?.kills[0]).not.toHaveProperty("soloKill");
	expect(edge(solo.state, "lane", {}, "top", 200).causes).toContainEqual({
		key: "soloExperience",
		points: expect.any(Number),
	});
	expect(
		edge(solo.state, "lane", {}, "mid", 200).causes.map(({ key }) => key),
	).not.toContain("soloExperience");
});

test("a steal can only award a pit objective and its actual buff to the opposing jungler's team", () => {
	let barons = 0;
	let stolen = 0;
	fc.assert(
		fc.property(fc.integer({ min: 0, max: 5000 }), (seed) => {
			const game = playMatch(matchSetup({ seed }), MATCH_CONTESTS);
			const first = game.events.flatMap(({ kills }) => kills)[0];
			expect(first).toHaveProperty("firstBlood");
			expect(
				game.events
					.flatMap(({ kills }) => kills)
					.filter((k) => "firstBlood" in k),
			).toHaveLength(1);
			for (const e of game.events) {
				if (!("steal" in e) || !e.steal) continue;
				stolen++;
				expect(["dragon", "baron", "herald"]).toContain(e.kind);
				expect(e.steal).toMatchObject({
					controllingSide: e.side === "blue" ? "red" : "blue",
					jungler: base.context[e.side].players.jungle,
				});
				if (e.kind !== "baron") continue;
				barons++;
				expect(e.gold[e.side]).toBe(rules.baron);
				expect(game.snapshots[e.minute]?.[e.side].buffs.baron).toBeGreaterThan(
					0,
				);
			}
		}),
		{ numRuns: 60, seed: 508, examples: [[117]] },
	);
	expect(stolen).toBeGreaterThan(0);
	expect(barons).toBeGreaterThan(0);
});
