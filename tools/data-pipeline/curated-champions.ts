import { kitTraits } from "./champion-kit-rules.ts";
import type { ChampionKit } from "./champion-kit-source.ts";
import { curated, type Profile } from "./curated-champion-data.ts";

const classDefaults: Readonly<Record<string, Profile>> = {
	assassin: [["mid"], "physical", "mid", ["dive", "pick"], 3, 8, 2],
	fighter: [["top"], "physical", "mid", ["skirmish"], 5, 5, 6],
	mage: [["mid"], "magic", "mid", ["poke"], 5, 2, 2],
	marksman: [["bot"], "physical", "late", ["carry"], 2, 4, 2],
	support: [["support"], "utility", "mid", ["peel", "utility"], 6, 3, 3],
	tank: [["top"], "magic", "mid", ["tank", "engage"], 8, 3, 9],
};
const generic: Profile = [["mid"], "mixed", "mid", ["skirmish"], 5, 5, 5];

export function championProfile(
	id: string,
	classes: readonly string[],
	kit?: ChampionKit,
) {
	const profile = Object.hasOwn(curated, id) ? curated[id] : undefined;
	const fallback = classes.find((tag) => Object.hasOwn(classDefaults, tag));
	const [
		roles,
		curatedDamage,
		power,
		archetypes,
		curatedCc,
		curatedMobility,
		frontline,
		uncertain,
	] = profile ?? (fallback ? classDefaults[fallback] : undefined) ?? generic;
	const { estimate, profile: derived, ...traits } = kitTraits(id, classes, kit);
	// What the game data decides is never replaced by the curated table.
	const damage = derived.damage ?? curatedDamage;
	const cc = derived.cc ?? curatedCc;
	const mobility = derived.mobility ?? curatedMobility;
	return {
		roles,
		damage,
		power,
		archetypes,
		cc,
		mobility,
		frontline,
		...traits,
		estimate: profile
			? uncertain || estimate
				? "curation"
				: undefined
			: "class",
	};
}
