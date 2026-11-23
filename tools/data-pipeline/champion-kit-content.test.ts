import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { deriveChampionContent } from "./champion-content.ts";
import { readKit, readTooltips } from "./champion-kit-source.ts";

const fixture = (name: string): unknown =>
	JSON.parse(
		readFileSync(
			new URL(`./fixtures/communitydragon/${name}`, import.meta.url),
			"utf8",
		),
	);
const tooltips = readTooltips(fixture("stringtable.json"));
const ids = ["Galio", "Thresh", "Malphite", "Yasuo", "Soraka", "Jinx"];
const catalog = ids.map((id, key) => ({ id, key, classes: [] }));
const kits = new Map(
	ids
		.filter((id) => id !== "Jinx")
		.map((id) => [
			id,
			readKit(id, fixture(`${id.toLowerCase()}.bin.json`), tooltips),
		]),
);

it("reports where each champion's traits come from", () => {
	const { traits } = deriveChampionContent(catalog, [], { kits });
	const byId = new Map(traits.map((row) => [row.id, row]));
	expect(byId.get("Galio")?.sources).toMatchObject({
		range: "source",
		kit: "rule",
	});
	expect(byId.get("Galio")?.estimatedKit).toEqual(["antiAp"]);
	// No kit data: every trait is an estimate and says so.
	expect(byId.get("Jinx")?.sources.range).toBe("estimated");
});

it("changes the relationships when the game data changes a trait", () => {
	const without = deriveChampionContent(catalog, []);
	const withKits = deriveChampionContent(catalog, [], { kits });
	expect(JSON.stringify(withKits.counters)).not.toBe(
		JSON.stringify(without.counters),
	);
	const again = deriveChampionContent([...catalog].reverse(), [], { kits });
	expect(JSON.stringify(again)).toBe(JSON.stringify(withKits));
});
