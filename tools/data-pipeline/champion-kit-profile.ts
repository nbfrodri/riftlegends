// Profile values the game data decides (#340): damage type, crowd control
// level and mobility. frontline, power and archetypes stay curated estimates.
import type { ChampionKit, KitSlot } from "./champion-kit-source.ts";

const castSlots = ["q", "w", "e", "r"] as const;
const hardStatuses = new Set([
	"knockup",
	"knockback",
	"pull",
	"stun",
	"root",
	"charm",
	"fear",
	"taunt",
	"suppress",
	"sleep",
	"polymorph",
	"disable",
]);
const areaTags = ["AoE", "Target_Area"];
const has = (slot: KitSlot, ...tags: string[]) =>
	tags.some((tag) => slot.tags.includes(tag));

/** A spell that only acts on an airborne target is no crowd control. */
export const needsAirborne = (slot: KitSlot) =>
	slot.statuses.includes("airborne") &&
	!slot.statuses.some((status) => hardStatuses.has(status));
export const isHardCc = (slot: KitSlot) =>
	!needsAirborne(slot) &&
	(slot.statuses.some((status) => hardStatuses.has(status)) ||
		has(slot, "ImmobilizingCCSpell", "ImmobilizingCCAbility"));

/**
 * Damage type: 70 % or more of one type is that type, otherwise mixed;
 * enchanters (support healers and shielders) are utility.
 */
export function damageOf(
	split: readonly [number, number, number],
	enchanter: boolean,
) {
	if (enchanter) return "utility" as const;
	if (split[0] >= 70) return "physical" as const;
	if (split[1] >= 70) return "magic" as const;
	return "mixed" as const;
}

const skillshotTags = [
	"Ranged_StopsFirstHit",
	"Ranged_Piercing",
	"Target_Directional",
];
const confirmed = ["ImmobilizingCCSpell", "ImmobilizingCCAbility"];
const hardCount = (slot: KitSlot) =>
	slot.statuses.filter((status) => hardStatuses.has(status)).length;

/**
 * Crowd control level 0 to 10, by how reliable each ability is.
 * Hard CC the game tags as immobilizing: 3, +1 in an area, +1 with two or
 * more kinds, +1 in the ultimate, -1 for a single-target skillshot (it can
 * be dodged). Hard CC the tags do not confirm (conditional, minions only)
 * counts 0. Only slows or silences: 1. The sum is capped at 10.
 */
export function ccLevel(kit: ChampionKit) {
	let points = 0;
	for (const id of castSlots) {
		const slot = kit.slots[id];
		const area = has(slot, ...areaTags);
		if (!isHardCc(slot)) {
			if (slot.statuses.some((s) => s === "slow" || s === "silence"))
				points += 1;
		} else if (has(slot, ...confirmed)) {
			points +=
				3 +
				(area ? 1 : 0) +
				(hardCount(slot) >= 2 ? 1 : 0) +
				(id === "r" ? 1 : 0) -
				(!area && has(slot, ...skillshotTags) ? 1 : 0);
		}
	}
	return Math.min(10, points);
}

/**
 * Mobility 0 to 10: 2, +1 for melee range. Each ability that dashes, blinks
 * or warps (tag or tooltip) adds 3 for the first and 2 for the next ones,
 * +2 if it is a teleport or blink tag and +1 in the ultimate. Other abilities
 * that grant movement speed add 1. The passive only adds 1.
 */
export function mobilityOf(kit: ChampionKit) {
	let points = 2 + (kit.attackRange <= 300 ? 1 : 0);
	let dashes = 0;
	for (const [id, slot] of Object.entries(kit.slots)) {
		const teleport = has(slot, "PositiveEffect_Teleport");
		const moves =
			slot.marks.includes("dash") ||
			teleport ||
			has(slot, "PlayerSelectedDashDirection");
		if (id === "p") {
			if (moves || slot.marks.includes("speed")) points += 1;
		} else if (moves) {
			points += (dashes++ ? 2 : 3) + (teleport ? 2 : 0) + (id === "r" ? 1 : 0);
		} else if (slot.marks.includes("speed")) points += 1;
	}
	return Math.min(10, points);
}
