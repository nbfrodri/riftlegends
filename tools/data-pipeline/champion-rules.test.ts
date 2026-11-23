import { expect, it } from "vitest";
import { deriveChampionContent } from "./champion-content.ts";
import { curatedTraitIds } from "./champion-traits.ts";

const catalog = curatedTraitIds.map((id, key) => ({ id, key, classes: [] }));
const content = deriveChampionContent(catalog, []);

it.each([
	["range", "Caitlyn", "Nilah", "bot"],
	["pokeVsLowSustain", "Jayce", "Kennen", "top"],
	["sustainVsPoke", "Irelia", "Jayce", "top"],
	["earlyVsScaling", "Renekton", "Kayle", "top"],
	["mobilityVsSkillshots", "Fizz", "Xerath", "mid"],
	["lockdownVsDash", "Poppy", "Riven", "top"],
	["antiHeal", "Katarina", "Sylas", "mid"],
	["shieldVsPoke", "Karma", "Brand", "support"],
	["shieldVsSustain", "Sett", "Aatrox", "top"],
	["tankShred", "Fiora", "Sion", "top"],
	["resistVsDamage", "Galio", "Veigar", "mid"],
	["resistVsDamage", "Malphite", "Tryndamere", "top"],
	["resistVsDamage", "Rammus", "Graves", "jungle"],
	["splitDuel", "Fiora", "Sion", "top"],
	["tankVsBurst", "Galio", "Zed", "mid"],
	["invadeVsFarm", "LeeSin", "Karthus", "jungle"],
	["counterGank", "Graves", "Nunu", "jungle"],
	["visionVsPick", "Maokai", "Pyke", "support"],
	["engageVsEnchanter", "Leona", "Sona", "support"],
	["enchanterVsPoke", "Soraka", "Zyra", "support"],
	["pokeVsEngage", "Zyra", "Leona", "support"],
	["projectileBlock", "Yasuo", "Ahri", "mid"],
] as const)(
	"%s favors %s against %s in %s",
	(rule, champion, against, role) => {
		const edge = content.matchups.find(
			(m) =>
				m.champion === champion && m.against === against && m.role === role,
		);
		expect(edge?.value).toBeGreaterThan(0);
		expect(edge?.reasons).toContain(rule);
	},
);

it.each([
	["assassinVsCarry", "Zed", "KogMaw"],
	["disengageVsEngage", "Janna", "Malphite"],
	["peelVsDive", "Lulu", "Rengar"],
	["aoeVsGrouped", "MissFortune", "Katarina"],
	["engageVsPoke", "Leona", "Xerath"],
	["lockdownVsCarry", "Nautilus", "KogMaw"],
	["hookVsImmobile", "Blitzcrank", "Varus"],
	["projectileBlock", "Braum", "Jinx"],
] as const)(
	"%s favors %s against %s across roles",
	(rule, champion, against) => {
		const edge = content.counters.find(
			(m) => m.champion === champion && m.against === against,
		);
		expect(edge?.value).toBeGreaterThan(0);
		expect(edge?.reasons).toContain(rule);
	},
);

it.each([
	["wombo", "Malphite", "MissFortune"],
	["hypercarryPeel", "KogMaw", "Lulu"],
	["pokeSiege", "Janna", "Ziggs"],
	["chainCc", "Galio", "Nautilus"],
	["knockupUlt", "Malphite", "Yasuo"],
	["earlyDuo", "Lucian", "Nami"],
	["scalingDuo", "Jinx", "Sona"],
	["pickVision", "Ashe", "Maokai"],
	["splitPressure", "Fiora", "Ziggs"],
	["damageMix", "Caitlyn", "Zyra"],
	["diveTogether", "Camille", "Vi"],
	["enchanterDiver", "Lulu", "Vi"],
	["frontToBack", "Ornn", "Jinx"],
] as const)("%s pairs %s with %s", (rule, left, right) => {
	const [a, b] = [left, right].sort();
	expect(
		content.synergies.find((m) => m.a === a && m.b === b)?.reasons,
	).toContain(rule);
});
