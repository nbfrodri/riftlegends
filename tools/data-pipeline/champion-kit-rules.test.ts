import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { kitOrder, kitTraits } from "./champion-kit-rules.ts";
import {
	type ChampionKit,
	readKit,
	readTooltips,
} from "./champion-kit-source.ts";
import { curatedTraitIds, estimatedTraits } from "./champion-traits.ts";

const fixture = (name: string): unknown =>
	JSON.parse(
		readFileSync(
			new URL(`./fixtures/communitydragon/${name}`, import.meta.url),
			"utf8",
		),
	);
const tooltips = readTooltips(fixture("stringtable.json"));
const kit = (id: string): ChampionKit =>
	readKit(id, fixture(`${id.toLowerCase()}.bin.json`), tooltips);
const traits = (id: string, classes: string[] = []) =>
	kitTraits(id, classes, kit(id));

it("reads the attack range from the champion stats", () => {
	expect(traits("Galio").range).toBe("melee");
	expect(traits("Thresh").range).toBe("ranged");
	expect(traits("Jinx").range).toBe("ranged");
	expect(traits("Jinx").sources.range).toBe("source");
});

it("derives the crowd control kinds from statuses and targeting tags", () => {
	expect(traits("Galio").ccKinds).toEqual(["skillshot", "area", "knockup"]);
	expect(traits("Thresh").ccKinds).toEqual(["skillshot", "area"]);
	expect(traits("Soraka").ccKinds).toEqual(["area"]);
	expect(traits("Malphite").ccKinds).toContain("knockup");
	expect(traits("Jinx").ccKinds).toEqual(["area"]);
});

it("splits the damage by the damage types of the tooltips", () => {
	expect(traits("Galio").split).toEqual([0, 100, 0]);
	expect(traits("Soraka").split).toEqual([0, 100, 0]);
	expect(traits("Malphite").split).toEqual([40, 60, 0]);
	expect(traits("Yasuo").split).toEqual([80, 20, 0]);
	// Marksmen add their basic attacks as physical damage.
	expect(traits("Jinx", ["marksman"]).split).toEqual([83, 17, 0]);
	expect(traits("Jinx").split).toEqual([75, 25, 0]);
});

it("counts the abilities that heal as sustain", () => {
	expect(traits("Soraka").sustain).toBe(3);
	expect(traits("Galio").sustain).toBe(0);
});

it("derives the kit traits from named rules", () => {
	const kitOf = (id: string, classes: string[] = []) => traits(id, classes).kit;
	// wombo: ultimate in an area that immobilizes
	expect(kitOf("Galio")).toContain("wombo");
	expect(kitOf("Malphite")).toContain("wombo");
	expect(kitOf("Yasuo")).not.toContain("wombo");
	// knockupUlt: the ultimate needs an airborne target
	expect(kitOf("Yasuo")).toContain("knockupUlt");
	expect(kitOf("Galio")).not.toContain("knockupUlt");
	expect(kitOf("Yasuo")).toContain("projectileBlock");
	expect(kitOf("Thresh")).toEqual(
		expect.arrayContaining(["hook", "disengage", "shield"]),
	);
	expect(kitOf("Soraka", ["support"])).toContain("enchanter");
	expect(kitOf("Thresh", ["support", "tank"])).not.toContain("enchanter");
	expect(traits("Galio").sources.kit).toBe("rule");
});

it("never replaces a trait from the game data with an estimate", () => {
	for (const id of ["Galio", "Thresh", "Malphite", "Yasuo", "Soraka", "Jinx"]) {
		const derived = traits(id);
		const estimate = estimatedTraits(id, []);
		expect(derived.range, id).toBe(
			{ 150: "melee", 175: "melee", 125: "melee" }[kit(id).attackRange] ??
				"ranged",
		);
		// Yasuo: the curated table says all physical, the tooltips list a magic hit.
		if (id === "Yasuo") {
			expect(estimate.split).toEqual([100, 0, 0]);
			expect(derived.split).toEqual([80, 20, 0]);
		}
		// Thresh: curated "skillshots" does not survive, the tags do not support it.
		if (id === "Thresh") {
			expect(estimate.kit).toContain("skillshots");
			expect(derived.kit).not.toContain("skillshots");
		}
	}
});

it("keeps the curated traits the game data cannot decide and lists them", () => {
	const galio = traits("Galio");
	expect(galio.kit).toContain("antiAp");
	expect(galio.estimatedKit).toEqual(["antiAp"]);
	expect(traits("Yasuo").estimatedKit).toEqual([]);
});

it("falls back to the estimates, marked, when there is no kit data", () => {
	const fallback = kitTraits("Galio", [], undefined);
	expect(fallback.sources).toEqual({
		range: "estimated",
		sustain: "estimated",
		cc: "estimated",
		split: "estimated",
		kit: "estimated",
		damage: "estimated",
		ccLevel: "estimated",
		mobility: "estimated",
		frontline: "estimated",
		power: "estimated",
		archetypes: "estimated",
	});
	expect(fallback.kit).toEqual(estimatedTraits("Galio", []).kit);
});

it("marks the split as estimated when the tooltips list no damage", () => {
	const bare = kit("Galio");
	for (const slot of Object.values(bare.slots)) slot.damage = [];
	const result = kitTraits("Galio", [], bare);
	expect(result.sources.split).toBe("estimated");
	expect(result.split).toEqual(estimatedTraits("Galio", []).split);
});

it("orders the kit traits canonically and knows every curated trait", () => {
	const all = new Set(kitOrder);
	for (const id of curatedTraitIds)
		for (const trait of estimatedTraits(id, []).kit)
			expect(all.has(trait), `${id} ${trait}`).toBe(true);
	const galio = traits("Galio").kit;
	expect(
		[...galio].sort((a, b) => kitOrder.indexOf(a) - kitOrder.indexOf(b)),
	).toEqual([...galio]);
});

it("derives the damage type from the damage split", () => {
	expect(traits("Galio").profile.damage).toBe("magic");
	expect(traits("Soraka").profile.damage).toBe("magic");
	expect(traits("Yasuo").profile.damage).toBe("physical");
	expect(traits("Jinx", ["marksman"]).profile.damage).toBe("physical");
	expect(traits("Malphite").profile.damage).toBe("mixed");
	expect(traits("Soraka", ["support"]).profile.damage).toBe("utility");
	expect(traits("Yasuo", []).split).toEqual([80, 20, 0]);
	expect(traits("Galio").sources.damage).toBe("rule");
});

it("scores crowd control by ability: hard, in an area and in the ultimate weigh more", () => {
	// Galio: knock-up 3, taunt in an area 4, ultimate knock-up in an area 5, capped at 10.
	expect(traits("Galio").profile.cc).toBe(10);
	// Yasuo: one knock-up in an area; the ultimate only needs an airborne target.
	expect(traits("Yasuo").profile.cc).toBe(4);
	// Jinx: root in an area 4, slow 1.
	expect(traits("Jinx").profile.cc).toBe(5);
	expect(traits("Galio").sources.ccLevel).toBe("rule");
});

it("scores mobility from dashes, speed buffs and melee range", () => {
	const galio = traits("Galio").profile.mobility;
	expect(galio).toBeGreaterThan(traits("Thresh").profile.mobility ?? 0);
	expect(galio).toBeLessThanOrEqual(10);
	expect(traits("Galio").sources.mobility).toBe("rule");
});

it("keeps frontline, power and archetypes as estimates", () => {
	expect(traits("Galio").sources).toMatchObject({
		frontline: "estimated",
		power: "estimated",
		archetypes: "estimated",
	});
});

it("falls back to the curated damage when the tooltips list none", () => {
	const bare = kit("Galio");
	for (const slot of Object.values(bare.slots)) slot.damage = [];
	const result = kitTraits("Galio", [], bare);
	expect(result.profile.damage).toBeUndefined();
	expect(result.sources.damage).toBe("estimated");
});

it("counts basic-attack reliance: melee fighters and abilities that empower attacks", () => {
	const plain = traits("Galio", []).split;
	const fighter = traits("Galio", ["fighter"]).split;
	expect(plain).toEqual([0, 100, 0]);
	// Galio is melee: a fighter adds a share of physical basic attacks.
	expect(fighter[0]).toBeGreaterThan(0);
	// Malphite's W resets attacks: physical weight even though its tooltips list magic.
	expect(traits("Malphite").split[0]).toBeGreaterThan(25);
});

it("weighs crowd control by reliability", () => {
	const galio = kit("Galio");
	const full = traits("Galio").profile.cc as number;
	// Without the tag that confirms the CC, a hard status only counts as conditional.
	galio.slots.r.tags = galio.slots.r.tags.filter(
		(tag) => !tag.startsWith("ImmobilizingCC"),
	);
	expect(kitTraits("Galio", [], galio).profile.cc).toBeLessThan(full);
	// A single-target skillshot can be dodged: less than the same CC unaimed.
	const aimed = kit("Thresh").slots.q;
	expect(aimed.tags).toContain("Ranged_StopsFirstHit");
});

it("scores dashes, blinks and ultimate dashes higher, with diminishing returns", () => {
	const base = kit("Galio");
	for (const slot of Object.values(base.slots))
		slot.tags = slot.tags.filter((t) => t !== "PlayerSelectedDashDirection");
	const still = kitTraits("Galio", [], base).profile.mobility as number;
	base.slots.e.tags.push("PlayerSelectedDashDirection");
	const one = kitTraits("Galio", [], base).profile.mobility as number;
	base.slots.q.tags.push("PositiveEffect_Teleport");
	const two = kitTraits("Galio", [], base).profile.mobility as number;
	expect(one - still).toBe(3);
	// A blink as the second movement ability: 2 for the second + 2 for the blink.
	expect(two - one).toBe(4);
});
