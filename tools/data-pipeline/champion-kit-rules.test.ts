import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { kitTraits, kitOrder } from "./champion-kit-rules.ts";
import { type ChampionKit, readKit, readTooltips } from "./champion-kit-source.ts";
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
	expect(traits("Malphite").split).toEqual([25, 75, 0]);
	expect(traits("Yasuo").split).toEqual([75, 25, 0]);
	// Marksmen add their basic attacks as physical damage.
	expect(traits("Jinx", ["marksman"]).split).toEqual([83, 17, 0]);
	expect(traits("Jinx").split).toEqual([75, 25, 0]);
});

it("counts the abilities that heal as sustain", () => {
	expect(traits("Soraka").sustain).toBe(3);
	expect(traits("Galio").sustain).toBe(0);
});

it("derives the kit traits from named rules", () => {
	const kitOf = (id: string, classes: string[] = []) =>
		traits(id, classes).kit;
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
			expect(derived.split).toEqual([75, 25, 0]);
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
	expect([...galio].sort((a, b) => kitOrder.indexOf(a) - kitOrder.indexOf(b)))
		.toEqual([...galio]);
});
