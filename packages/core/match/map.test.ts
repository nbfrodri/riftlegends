import type { MatchEvent, Side } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "./fixtures/content";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";

const SEEDS = 120;
const games = Array.from({ length: SEEDS }, (_, seed) =>
	playMatch(matchSetup({ seed }), MATCH_CONTESTS),
);
const { rules } = fictionalMatchContent;
const minutes = (seconds: number) =>
	(seconds + 59 - ((seconds + 59) % 60)) / 60;
const other = (side: Side): Side => (side === "blue" ? "red" : "blue");
type Lane = "top" | "mid" | "bot";
const laneOf = (event: MatchEvent) => event.zone.slice(5) as Lane;

describe("M2 · a game ends when a nexus falls", () => {
	it("every game ends with one nexus, as its last event, well before minute 70", () => {
		for (const { state, events } of games) {
			const nexus = events.filter((e) => e.kind === "nexus");
			expect(nexus).toHaveLength(1);
			expect(events.at(-1)).toBe(nexus[0]);
			expect(state.winner).toBe(nexus[0]?.side);
			expect(state.minute).toBe(nexus[0]?.minute);
			expect(state.minute).toBeLessThan(70);
		}
	});

	it("both sides win games", () => {
		const blue = games.filter((g) => g.state.winner === "blue").length;
		expect(blue).toBeGreaterThan(0);
		expect(blue).toBeLessThan(SEEDS);
	});
});

describe("M3 · map rules", () => {
	it("places each event in a zone that fits its kind", () => {
		const zones: Record<string, (e: MatchEvent) => string[]> = {
			dragon: () => ["dragon-pit"],
			elder: () => ["dragon-pit"],
			herald: () => ["baron-pit"],
			baron: () => ["baron-pit"],
			tower: (e) =>
				e.tier === 4
					? [`base-${other(e.side)}`]
					: ["lane-top", "lane-mid", "lane-bot"],
			inhibitor: () => ["lane-top", "lane-mid", "lane-bot"],
			nexus: (e) => [`base-${other(e.side)}`],
		};
		for (const { events } of games) {
			for (const event of events) {
				const allowed = zones[event.kind];
				if (allowed) expect(allowed(event)).toContain(event.zone);
			}
		}
	});

	it("takes structures in order: towers, inhibitor, nexus towers, nexus", () => {
		for (const { events } of games) {
			// Lost structures, by the side that owned them.
			const towers = {
				blue: { top: 0, mid: 0, bot: 0 },
				red: { top: 0, mid: 0, bot: 0 },
			};
			const inhibitors = {
				blue: { top: -1, mid: -1, bot: -1 },
				red: { top: -1, mid: -1, bot: -1 },
			};
			const nexusTowers = { blue: 0, red: 0 };
			const inhibitorDown = (owner: Side, minute: number) =>
				Object.values(inhibitors[owner]).some((back) => back > minute);
			for (const e of events) {
				const owner = other(e.side);
				if (e.kind === "tower" && e.tier !== 4) {
					const lane = laneOf(e);
					expect(e.tier).toBe(towers[owner][lane] + 1);
					towers[owner][lane] += 1;
				}
				if (e.kind === "inhibitor") {
					const lane = laneOf(e);
					expect(towers[owner][lane]).toBe(3);
					expect(inhibitors[owner][lane]).toBeLessThanOrEqual(e.minute);
					inhibitors[owner][lane] = e.minute + minutes(rules.inhibitorRespawn);
				}
				if (e.kind === "tower" && e.tier === 4) {
					expect(inhibitorDown(owner, e.minute)).toBe(true);
					expect(nexusTowers[owner]).toBeLessThan(2);
					nexusTowers[owner] += 1;
				}
				if (e.kind === "nexus") {
					expect(nexusTowers[owner]).toBe(2);
					expect(inhibitorDown(owner, e.minute)).toBe(true);
				}
			}
		}
	});

	it("respects when each objective spawns and respawns", () => {
		for (const { events } of games) {
			const last: Record<string, number> = {};
			const dragons = { blue: 0, red: 0 };
			for (const e of events) {
				const timer =
					e.kind === "dragon" ||
					e.kind === "herald" ||
					e.kind === "baron" ||
					e.kind === "elder"
						? rules.objectives[e.kind]
						: null;
				if (!timer) continue;
				const previous = last[e.kind];
				expect(e.minute).toBeGreaterThanOrEqual(
					previous === undefined
						? minutes(timer.first)
						: previous + minutes(timer.respawn),
				);
				last[e.kind] = e.minute;
				if (e.kind === "dragon") {
					expect(dragons.blue < 4 && dragons.red < 4).toBe(true);
					dragons[e.side] += 1;
				}
				if (e.kind === "elder") {
					expect(dragons.blue === 4 || dragons.red === 4).toBe(true);
				}
				if (e.kind === "herald") {
					expect(e.minute).toBeLessThan(minutes(rules.objectives.baron.first));
				}
			}
		}
	});

	it("pays each structure and objective to the side that takes it", () => {
		const { economy } = rules;
		for (const { events } of games) {
			for (const e of events) {
				const pay: Record<string, number> = {
					tower: economy.tower,
					inhibitor: economy.inhibitor,
					dragon: economy.dragon,
					herald: economy.herald,
					baron: economy.baron,
					elder: economy.elder,
				};
				const amount = pay[e.kind];
				if (amount === undefined) continue;
				expect(e.gold[e.side]).toBe(amount);
				expect(e.gold[other(e.side)]).toBe(0);
			}
		}
	});
});

describe("kills go to the killer's side", () => {
	it("even in fights where both sides score", () => {
		const roster = (team: string) =>
			new Set(
				fictionalContent.players
					.filter((p) => p.team === team)
					.map((p) => p.id),
			);
		const blue = roster("forge");
		let mutual = 0;
		for (const { state, events } of games) {
			const kills = events.flatMap((e) => e.kills);
			if (
				events.some((e) =>
					e.kills.some((k) => blue.has(k.killer) !== (e.side === "blue")),
				)
			)
				mutual++;
			expect(state.blue.kills).toBe(
				kills.filter((k) => blue.has(k.killer)).length,
			);
			expect(state.red.kills).toBe(
				kills.filter((k) => !blue.has(k.killer)).length,
			);
		}
		expect(mutual).toBeGreaterThan(0);
	});
});
