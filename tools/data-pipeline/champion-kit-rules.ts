// Rules that turn the CommunityDragon kit facts into the traits the champion
// rule base reads (#340, plan 11). A trait the game data decides is never
// replaced by the curated estimate; only the traits it cannot decide are kept
// from the table and listed for review.

import {
	ccLevel,
	damageOf,
	isHardCc as hardCc,
	mobilityOf,
	needsAirborne,
} from "./champion-kit-profile.ts";
import type { ChampionKit, KitSlot } from "./champion-kit-source.ts";
import { estimatedTraits, type Kit } from "./champion-traits.ts";

type TraitSource = "source" | "rule" | "estimated";
interface TraitSources {
	range: TraitSource;
	sustain: TraitSource;
	cc: TraitSource;
	split: TraitSource;
	kit: TraitSource;
	damage: TraitSource;
	ccLevel: TraitSource;
	mobility: TraitSource;
	// The game data does not decide these; they always come from the table.
	frontline: TraitSource;
	power: TraitSource;
	archetypes: TraitSource;
}

/** Canonical order of the kit traits in the generated content. */
export const kitOrder: readonly Kit[] = [
	"wombo",
	"aoe",
	"disengage",
	"enchanter",
	"siege",
	"invade",
	"farm",
	"antiheal",
	"shield",
	"shred",
	"vision",
	"duel",
	"skillshots",
	"antiDash",
	"antiAp",
	"antiAd",
	"knockupUlt",
	"projectileBlock",
	"projectiles",
	"hook",
	"competitive",
];

/** Kit traits the game data decides (both ways); the rest stay estimates. */
const decided: ReadonlySet<Kit> = new Set([
	"wombo",
	"aoe",
	"disengage",
	"enchanter",
	"antiheal",
	"shield",
	"shred",
	"skillshots",
	"knockupUlt",
	"projectileBlock",
	"projectiles",
	"hook",
]);

const castSlots = ["q", "w", "e", "r"] as const;
const hasTag = (slot: KitSlot, ...tags: string[]) =>
	tags.some((tag) => slot.tags.includes(tag));

const areaTags = ["AoE", "Target_Area"];
const missileTags = ["Ranged_StopsFirstHit", "Ranged_Piercing"];
const skillshotTags = [...missileTags, "Target_Directional"];
const aimedTags = [...skillshotTags, "PlayerSelectedDashDirection"];

// range: melee up to 300 units, long from 575 (artillery and long autos).
const rangeOf = (units: number): "melee" | "ranged" | "long" =>
	units <= 300 ? "melee" : units >= 575 ? "long" : "ranged";

function ccKinds(kit: ChampionKit) {
	const hard = castSlots.map((id) => kit.slots[id]).filter(hardCc);
	const kinds = [
		["targeted", hard.some((s) => !hasTag(s, ...areaTags, ...aimedTags))],
		["skillshot", hard.some((s) => hasTag(s, ...aimedTags))],
		["area", hard.some((s) => hasTag(s, ...areaTags))],
		[
			"knockup",
			castSlots.some((id) => kit.slots[id].statuses.includes("knockup")),
		],
	] as const;
	return kinds.filter(([, present]) => present).map(([kind]) => kind);
}

function sustainOf(kit: ChampionKit) {
	const healing = Object.values(kit.slots).filter(
		(slot) =>
			slot.marks.includes("heal") || hasTag(slot, "ActiveHeal", "SelfHeal"),
	).length;
	return Math.min(3, healing) as 0 | 1 | 2 | 3;
}

// Each ability that deals damage weighs 12 (shared evenly between its types).
// Basic attacks add physical weight: 24 for marksmen, 12 for melee fighters
// and assassins, and 12 for each ability that empowers or resets them.
function splitOf(kit: ChampionKit, classes: readonly string[]) {
	const weight = { physical: 0, magic: 0, true: 0 };
	for (const slot of Object.values(kit.slots)) {
		for (const type of slot.damage) weight[type] += 12 / slot.damage.length;
	}
	const total = weight.physical + weight.magic + weight.true;
	if (!total) return undefined;
	const meleeFighter =
		kit.attackRange <= 300 &&
		(classes.includes("fighter") || classes.includes("assassin"));
	const autos =
		(classes.includes("marksman") ? 24 : 0) +
		(meleeFighter ? 12 : 0) +
		12 *
			Object.values(kit.slots).filter((slot) =>
				hasTag(
					slot,
					"AttackReset",
					"AttackBuff_Duration",
					"PositiveEffect_EmpowerAttack",
					"Strike",
				),
			).length;
	weight.physical += autos;
	const sum = total + autos;
	const parts = [weight.physical, weight.magic, weight.true].map(
		(w) => (w * 100) / sum,
	);
	const floors = parts.map(Math.floor);
	let rest = 100 - floors.reduce((a, b) => a + b, 0);
	const byRemainder = parts
		.map((part, index) => [part - Math.floor(part), index] as const)
		.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
	for (const [, index] of byRemainder) {
		if (rest-- <= 0) break;
		floors[index] = (floors[index] ?? 0) + 1;
	}
	return floors as [number, number, number];
}

function derivedKit(kit: ChampionKit, classes: readonly string[]) {
	const slots = castSlots.map((id) => kit.slots[id]);
	const every = Object.values(kit.slots);
	const count = (test: (slot: KitSlot) => boolean) => slots.filter(test).length;
	const isAlly = (slot: KitSlot) =>
		slot.marks.includes("heal") || slot.marks.includes("shield");
	const traits: [Kit, boolean][] = [
		// wombo: the ultimate immobilizes in an area.
		["wombo", hardCc(kit.slots.r) && hasTag(kit.slots.r, ...areaTags)],
		// aoe: at least two abilities deal area damage.
		["aoe", count((s) => hasTag(s, "AoE") && hasTag(s, "DamageAbility")) >= 2],
		// disengage: knocks enemies back.
		[
			"disengage",
			slots.some(
				(s) => hasTag(s, "KnockBack") || s.statuses.includes("knockback"),
			),
		],
		// enchanter: support that heals or shields with at least two abilities.
		[
			"enchanter",
			classes.includes("support") &&
				!classes.includes("tank") &&
				count(isAlly) >= 2,
		],
		["antiheal", every.some((s) => s.marks.includes("antiheal"))],
		[
			"shield",
			every.some(
				(s) =>
					s.marks.includes("shield") || hasTag(s, "Shield", "PassiveShield"),
			),
		],
		// shred: any true damage in the kit.
		["shred", every.some((s) => s.damage.includes("true"))],
		// skillshots: two or more aimed abilities; projectiles: two or more missiles.
		["skillshots", count((s) => hasTag(s, ...skillshotTags)) >= 2],
		["projectiles", count((s) => hasTag(s, ...missileTags)) >= 2],
		["projectileBlock", every.some((s) => hasTag(s, "ProjectileDestruction"))],
		// hook: pulls with an aimed missile.
		[
			"hook",
			slots.some((s) => s.statuses.includes("pull") && hasTag(s, ...aimedTags)),
		],
		// knockupUlt: the ultimate needs an airborne target.
		["knockupUlt", needsAirborne(kit.slots.r)],
	];
	return new Set(traits.filter(([, on]) => on).map(([trait]) => trait));
}

export function kitTraits(
	id: string,
	classes: readonly string[],
	kit: ChampionKit | undefined,
) {
	const estimate = estimatedTraits(id, classes);
	if (!kit) {
		return {
			...estimate,
			sources: {
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
			} satisfies TraitSources,
			profile: {} as {
				damage?: "physical" | "magic" | "mixed" | "utility";
				cc?: number;
				mobility?: number;
			},
			estimatedKit: [...estimate.kit],
		};
	}
	const split = splitOf(kit, classes);
	const derived = derivedKit(kit, classes);
	const kept = estimate.kit.filter((trait) => !decided.has(trait));
	const merged = new Set<Kit>([...derived, ...kept]);
	return {
		range: rangeOf(kit.attackRange),
		sustain: sustainOf(kit),
		ccKinds: ccKinds(kit),
		split: split ?? estimate.split,
		kit: kitOrder.filter((trait) => merged.has(trait)),
		estimate: estimate.estimate,
		profile: {
			damage: split ? damageOf(split, derived.has("enchanter")) : undefined,
			cc: ccLevel(kit),
			mobility: mobilityOf(kit),
		} as {
			damage?: "physical" | "magic" | "mixed" | "utility";
			cc?: number;
			mobility?: number;
		},
		sources: {
			range: "source",
			sustain: "rule",
			cc: "rule",
			split: split ? "rule" : "estimated",
			kit: "rule",
			damage: split ? "rule" : "estimated",
			ccLevel: "rule",
			mobility: "rule",
			frontline: "estimated",
			power: "estimated",
			archetypes: "estimated",
		} satisfies TraitSources,
		estimatedKit: kitOrder.filter((trait) => kept.includes(trait)),
	};
}
