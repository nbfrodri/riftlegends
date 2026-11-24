import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
	bin,
	type ChampionKit,
	normalizeStatus,
	readKit,
	readTooltips,
	tooltipsBody,
} from "./champion-kit-source.ts";

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

it("reads the attack range and the ultimate cooldown per rank", () => {
	expect(kit("Galio")).toMatchObject({
		attackRange: 150,
		ultCooldown: [180, 160, 140],
	});
	expect(kit("Jinx").ultCooldown).toEqual([85, 65, 45]);
	expect(kit("Yasuo").ultCooldown).toEqual([70, 50, 30]);
	expect(kit("Thresh").attackRange).toBe(450);
});

it("reads the crowd control of each ability from the official tooltips", () => {
	expect(kit("Galio").slots.e.statuses).toEqual(["knockup"]);
	expect(kit("Galio").slots.w.statuses).toEqual(["slow", "taunt"]);
	expect(kit("Thresh").slots.q.statuses).toEqual(["pull", "stun"]);
	expect(kit("Malphite").slots.r.statuses).toEqual(["knockup"]);
	expect(kit("Soraka").slots.e.statuses).toEqual(["root", "silence"]);
	expect(kit("Yasuo").slots.r.statuses).toEqual(["airborne"]);
});

it("reads the damage types, shields and heals", () => {
	expect(kit("Galio").slots.r.damage).toEqual(["magic"]);
	expect(kit("Galio").slots.r.marks).toEqual(["shield"]);
	expect(kit("Malphite").slots.w.damage).toEqual(["physical"]);
	expect(kit("Jinx").slots.r.damage).toEqual(["physical"]);
	expect(kit("Soraka").slots.w.marks).toEqual(["heal"]);
	expect(kit("Soraka").slots.r.marks).toEqual(["heal"]);
});

it("keeps the spell tags that describe targeting and crowd control", () => {
	expect(kit("Galio").slots.r.tags).toEqual(
		expect.arrayContaining(["Ultimate", "ImmobilizingCCSpell", "AoE"]),
	);
	expect(kit("Yasuo").slots.w.tags).toContain("ProjectileDestruction");
	expect(kit("Thresh").slots.q.tags).toContain("Ranged_StopsFirstHit");
	expect(kit("Soraka").slots.e.tags).toContain("Target_Area");
});

it("has no ultimate cooldown when the fourth slot is not an ultimate", () => {
	const body = structuredClone(fixture("galio.bin.json")) as Record<
		string,
		{ mSpell?: { mSpellTags?: string[] } }
	>;
	const spell = body["Characters/Galio/Spells/GalioRAbility/GalioR"];
	if (spell?.mSpell) spell.mSpell.mSpellTags = ["Trait_AoE"];
	expect(readKit("Galio", body, tooltips).ultCooldown).toBeNull();
});

it("reads the main spell even when the ability does not list it as a child", () => {
	const body = structuredClone(fixture("galio.bin.json")) as Record<
		string,
		{ mChildSpells?: string[] }
	>;
	const ability = body["Characters/Galio/Spells/GalioRAbility"];
	if (ability) ability.mChildSpells = [];
	expect(readKit("Galio", body, tooltips).slots.r.statuses).toEqual([
		"knockup",
	]);
});

it("reads movement speed and teleports as mobility signals", () => {
	const custom = { ...tooltips, spell_galioq_tooltip: "<speed>x</speed>" };
	const galio = readKit("Galio", fixture("galio.bin.json"), custom);
	expect(galio.slots.q.marks).toEqual(["speed"]);
	const moving = {
		...tooltips,
		spell_galioq_tooltip: "Galio dashes forward, then Blinks away.",
	};
	expect(
		readKit("Galio", fixture("galio.bin.json"), moving).slots.q.marks,
	).toEqual(["dash"]);
});

it("rejects a response without a character record", () => {
	expect(() => readKit("Galio", {}, tooltips)).toThrow(/character record/i);
});

it("normalizes tooltip status words", () => {
	const words: Record<string, string | undefined> = {
		"Knocking Up": "knockup",
		"Knocks Up": "knockup",
		Airborne: "airborne",
		"Knocking Back": "knockback",
		Pulling: "pull",
		Drags: "pull",
		Stunned: "stun",
		Rooting: "root",
		Immobilized: "root",
		Charms: "charm",
		Fear: "fear",
		Slowing: "slow",
		Silences: "silence",
		"@Slow_Amount*100@%": undefined,
	};
	for (const [word, status] of Object.entries(words))
		expect(normalizeStatus(word), word).toBe(status);
});

it("stores only spell tooltips and accepts its own cached shape", () => {
	const cached = tooltipsBody(tooltips);
	expect(
		Object.keys(cached.entries).every((key) => key.endsWith("_tooltip")),
	).toBe(true);
	expect(readTooltips(cached)).toEqual(tooltips);
	expect(
		readTooltips({ entries: { other: "x", spell_a_tooltip: "y" } }),
	).toEqual({ spell_a_tooltip: "y" });
});

it("builds the CommunityDragon urls from the pinned patch", () => {
	expect(bin("16.23", "MonkeyKing")).toBe(
		"https://raw.communitydragon.org/16.23/game/data/characters/monkeyking/monkeyking.bin.json",
	);
});
