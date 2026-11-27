import { readFileSync } from "node:fs";
import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { kitTraits } from "./champion-kit-rules.ts";
import { curatedTraitIds, estimatedTraits } from "./champion-traits.ts";

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

it("#340 takes control, damage and the ultimate cooldown from the game data", () => {
	const champions = read("champions") as { id: string }[];
	const kits = read("kits") as {
		id: string;
		attackRange: number;
		ultCooldown: number[] | null;
		slots: Record<string, { damage: string[] }>;
	}[];
	const traits = read("traits") as {
		id: string;
		sources: Record<string, string>;
	}[];
	const { kits: kitSource, traitsToReview } = read("provenance");
	expect(kitSource.missing).toEqual([]);
	expect(kits.map(({ id }) => id)).toEqual(champions.map(({ id }) => id));
	expect(traits.map(({ id }) => id)).toEqual(champions.map(({ id }) => id));
	for (const { id, attackRange, ultCooldown, slots } of kits) {
		expect(attackRange, id).toBeGreaterThan(0);
		// Zero or scripted cooldowns are listed, never invented.
		expect(kitSource.noUltimateCooldown.includes(id), id).toBe(!ultCooldown);
		if (ultCooldown) {
			expect(ultCooldown, id).toHaveLength(3);
			expect(
				ultCooldown.every((seconds) => seconds > 0),
				id,
			).toBe(true);
		}
		const damage = Object.values(slots).some((slot) => slot.damage.length);
		expect(traitsToReview.includes(id), id).toBe(!damage);
	}
	// No ultimate waits under 10 s unless its short cooldown is by design: it
	// swaps forms, stacks or recasts (#622). Charged ultimates take the recharge
	// of one charge (rule chargeRecharge), so Teemo waits 25 s or more.
	const shortByDesign = new Set([
		"Anivia",
		"Belveth",
		"Elise",
		"Jayce",
		"Kassadin",
		"KogMaw",
		"Nidalee",
		"Quinn",
		"Samira",
		"Zoe",
	]);
	const rows = read("champions") as {
		id: string;
		ultCooldownTenths: number[];
	}[];
	const tooShort = rows.filter(
		({ id, ultCooldownTenths }) =>
			Math.min(...ultCooldownTenths) < 100 && !shortByDesign.has(id),
	);
	expect(tooShort.map(({ id }) => id)).toEqual([]);
	expect(
		rows
			.find(({ id }) => id === "Teemo")
			?.ultCooldownTenths.every((t) => t >= 200),
	).toBe(true);
	const published = read("champions") as {
		id: string;
		traitSources: Record<string, string>;
	}[];
	expect(
		published.find(({ id }) => id === "Teemo")?.traitSources.ultCooldownTenths,
	).toBe("rule");
	// Few champions lack the data; the list is the review queue.
	expect(kitSource.noUltimateCooldown.length).toBeLessThanOrEqual(5);
	expect(traitsToReview.length).toBeLessThanOrEqual(5);
	for (const { id, sources } of traits)
		expect(sources.range, id).toBe("source");
});

it("#340 never replaces a trait from the game data with an estimate", () => {
	const champions = read("champions") as { id: string }[];
	const kits = new Map(
		(read("kits") as { id: string }[]).map((kit) => [kit.id, kit]),
	);
	for (const { id } of champions) {
		const derived = kitTraits(id, [], kits.get(id) as never);
		for (const trait of derived.estimatedKit)
			expect(estimatedTraits(id, []).kit, id).toContain(trait);
		// What the data decides is absent from the estimated list.
		for (const trait of ["wombo", "hook", "projectileBlock", "knockupUlt"])
			expect(derived.estimatedKit, `${id} ${trait}`).not.toContain(trait);
	}
});
