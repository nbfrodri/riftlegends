import { ARCHETYPES, aiContent, ROLES, TIERS } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalContent as content } from "./content";

it("parses a fictional pool covering every draft profile", () => {
	const { champions, identities } = aiContent.parse(content);
	expect(champions.length).toBeGreaterThanOrEqual(40);
	expect(new Set(champions.map((c) => c.id)).size).toBe(champions.length);
	const positions = champions.flatMap((c) => c.positions);
	expect(new Set(positions.map((p) => p.role))).toEqual(new Set(ROLES));
	expect(new Set(positions.map((p) => p.tier))).toEqual(new Set(TIERS));
	expect(new Set(champions.flatMap((c) => c.archetypes))).toEqual(
		new Set(ARCHETYPES),
	);
	expect(new Set(champions.map((c) => c.damage))).toEqual(
		new Set(["physical", "magic", "mixed", "utility"]),
	);
	expect(new Set(champions.map((c) => c.power))).toEqual(
		new Set(["early", "mid", "late"]),
	);
	expect(identities.length).toBeGreaterThanOrEqual(4);
	expect(identities.length).toBeLessThanOrEqual(6);
});

it("links the matchups, combos and both five-role player pools to playable champions", () => {
	const { champions, matchups, synergies, players } = content;
	const roles = new Map(
		champions.map((c) => [c.id, c.positions.map((p) => p.role)]),
	);
	expect(new Set(matchups.map((m) => m.value)).size).toBeGreaterThan(1);
	for (const m of matchups) {
		expect(roles.get(m.champion)).toContain(m.role);
		expect(roles.get(m.against)).toContain(m.role);
	}
	expect(new Set(synergies.map((s) => s.value)).size).toBeGreaterThan(1);
	for (const { a, b } of synergies) {
		expect(roles.has(a) && roles.has(b)).toBe(true);
	}
	expect(new Set(players.map((p) => p.id)).size).toBe(10);
	expect(players).toHaveLength(10);
	const teams = new Set(players.map((p) => p.team));
	expect(teams.size).toBe(2);
	for (const team of teams) {
		expect(
			new Set(players.filter((p) => p.team === team).map((p) => p.role)),
		).toEqual(new Set(ROLES));
	}
	for (const p of players) {
		for (const pool of [p.mains, p.secondary, p.weak]) {
			expect(pool.length).toBeGreaterThan(0);
			for (const id of pool) expect(roles.get(id)).toContain(p.role);
		}
	}
});
