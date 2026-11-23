import { readFileSync } from "node:fs";
import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { estimatedTraits, curatedTraitIds } from "./champion-traits.ts";

const read = (file: string) =>
	JSON.parse(
		readFileSync(
			new URL(
				`../../packages/core/content/real/champions/${file}.json`,
				import.meta.url,
			),
			"utf8",
		),
	);

it("the committed real champion files satisfy the core content contracts", () => {
	const champions = read("champions");
	const matchups = read("matchups");
	const synergies = read("synergies");
	expect(
		aiContent.safeParse({
			champions: champions.map(
				({
					cc: _cc,
					mobility: _mobility,
					frontline: _frontline,
					...rest
				}: Record<string, unknown>) => rest,
			),
			matchups,
			counters: read("counters"),
			synergies,
			players: [],
			identities: [],
		}).error,
	).toBeUndefined();
	expect(
		matchContent.shape.champions.safeParse(
			champions.map(
				({ id, cc, mobility, frontline }: Record<string, unknown>) => ({
					id,
					cc,
					mobility,
					frontline,
				}),
			),
		).error,
	).toBeUndefined();
	expect(read("provenance").catalog.champions).toBe(champions.length);
});

it("R1/R3 give the entire playable catalog curated traits and meaningful relationships", () => {
	const champions = read("champions") as {
		id: string;
		positions: { role: string; tier: string }[];
	}[];
	const matchups = read("matchups") as {
		champion: string;
		against: string;
		role: string;
		value: number;
	}[];
	const counters = read("counters") as {
		champion: string;
		against: string;
		value: number;
	}[];
	const synergies = read("synergies") as {
		a: string;
		b: string;
		value: number;
	}[];
	expect([...curatedTraitIds].sort()).toEqual(
		champions.map(({ id }) => id).sort(),
	);
	const { estimated, classFallbacks } = read("provenance");
	expect(classFallbacks).toEqual([]);
	for (const { id, positions } of champions) {
		const traits = estimatedTraits(id, []);
		expect(
			traits.split.reduce((sum, damage) => sum + damage, 0),
			id,
		).toBe(100);
		if (traits.estimate) expect(estimated, id).toContain(id);
		expect(positions.length, id).toBeGreaterThan(0);
		expect(
			positions.every(({ tier }) =>
				["S+", "S", "A", "B", "C", "D"].includes(tier),
			),
			id,
		).toBe(true);
		const relationships = [...matchups, ...counters].filter(
			(row) => row.champion === id,
		);
		for (const direction of [-1, 1]) {
			const opponents = new Set(
				relationships
					.filter(({ value }) => value * direction > 0)
					.map(({ against }) => against),
			);
			expect(
				opponents.size,
				`${id} counter direction ${direction}`,
			).toBeGreaterThanOrEqual(3);
		}
		expect(
			synergies.filter(({ a, b }) => a === id || b === id).length,
			id,
		).toBeGreaterThanOrEqual(3);
	}
	const lane = new Map(
		matchups.map((m) => [
			JSON.stringify([m.champion, m.against, m.role]),
			m.value,
		]),
	);
	for (const { champion, against, role, value } of matchups)
		expect(lane.get(JSON.stringify([against, champion, role]))).toBe(-value);
	const team = new Map(
		counters.map((m) => [JSON.stringify([m.champion, m.against]), m.value]),
	);
	for (const { champion, against, value } of counters)
		expect(team.get(JSON.stringify([against, champion]))).toBe(-value);
	expect(synergies.every(({ a, b, value }) => a < b && value > 0)).toBe(true);
});
