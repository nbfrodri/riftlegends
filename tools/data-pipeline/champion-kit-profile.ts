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

/**
 * Crowd control level 0 to 10. Per ability: hard CC 3, +1 in an area, +1
 * more in the ultimate; only slows or silences 1. The sum is capped at 10.
 */
export function ccLevel(kit: ChampionKit) {
	let points = 0;
	for (const id of castSlots) {
		const slot = kit.slots[id];
		if (isHardCc(slot)) {
			points += 3 + (has(slot, ...areaTags) ? 1 : 0) + (id === "r" ? 1 : 0);
		} else if (
			slot.statuses.some((status) => status === "slow" || status === "silence")
		) {
			points += 1;
		}
	}
	return Math.min(10, points);
}

/**
 * Mobility 0 to 10: 2, +1 for melee range, +2 per ability that dashes,
 * blinks or teleports (tag or tooltip) and +1 per other ability (or the
 * passive) that grants speed.
 */
export function mobilityOf(kit: ChampionKit) {
	let points = 2 + (kit.attackRange <= 300 ? 1 : 0);
	for (const slot of Object.values(kit.slots)) {
		if (
			slot.marks.includes("dash") ||
			has(slot, "PlayerSelectedDashDirection", "PositiveEffect_Teleport")
		)
			points += 2;
		else if (slot.marks.includes("speed")) points += 1;
	}
	return Math.min(10, points);
}
