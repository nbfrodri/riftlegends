import type { ChampionReason, ROLES } from "@rift-legends/contracts";
import type { Kit } from "./champion-traits.ts";
import type { championProfile } from "./curated-champions.ts";

type Role = (typeof ROLES)[number];
type RuleProfile = ReturnType<typeof championProfile>;
type Archetype = RuleProfile["archetypes"][number];
type Test = (a: RuleProfile, b: RuleProfile, role?: Role) => boolean;
type Rule = readonly [id: ChampionReason, points: number, applies: Test];

const has = (p: RuleProfile, kind: Archetype) => p.archetypes.includes(kind);
const kit = (p: RuleProfile, trait: Kit) => p.kit.includes(trait);
const melee = (p: RuleProfile) => p.range === "melee";
const carry = (p: RuleProfile) => has(p, "carry") || has(p, "hypercarry");
const tank = (p: RuleProfile) => p.frontline >= 8;
const agile = (p: RuleProfile) => p.mobility >= 7;
const immobile = (p: RuleProfile) => p.mobility <= 3;
const diver = (p: RuleProfile) => melee(p) && has(p, "dive");
const assassin = (p: RuleProfile) =>
	(has(p, "pick") || has(p, "dive")) && agile(p) && p.frontline <= 4;
const enchanter = (p: RuleProfile) => kit(p, "enchanter");
const targeted = (p: RuleProfile) => p.ccKinds.includes("targeted");
const range = { melee: 0, ranged: 1, long: 2 } as const;

const lockdownVsDash: Test = (a, b) =>
	(targeted(a) || kit(a, "antiDash")) && melee(b) && agile(b);
const antiHeal: Test = (a, b) => kit(a, "antiheal") && b.sustain === 3;
const resistVsDamage: Test = (a, b) =>
	(kit(a, "antiAp") && b.split[1] >= 70) ||
	(kit(a, "antiAd") && b.split[0] >= 70);
const tankShred: Test = (a, b) => kit(a, "shred") && tank(b);
const visionVsPick: Test = (a, b) => kit(a, "vision") && has(b, "pick");
const projectileBlock: Test = (a, b) =>
	kit(a, "projectileBlock") && kit(b, "projectiles");

const laneRules: readonly Rule[] = [
	[
		"range",
		2,
		(a, b, role) => role !== "jungle" && range[a.range] > range[b.range],
	],
	[
		"pokeVsLowSustain",
		2,
		(a, b) =>
			has(a, "poke") && b.sustain <= 1 && !(agile(b) && kit(a, "skillshots")),
	],
	[
		"sustainVsPoke",
		2,
		(a, b) => a.sustain >= 2 && !has(a, "poke") && has(b, "poke"),
	],
	["earlyVsScaling", 3, (a, b) => a.power === "early" && b.power === "late"],
	["mobilityVsSkillshots", 3, (a, b) => agile(a) && kit(b, "skillshots")],
	["lockdownVsDash", 2, lockdownVsDash],
	["antiHeal", 2, antiHeal],
	["shieldVsPoke", 1, (a, b) => kit(a, "shield") && has(b, "poke")],
	[
		"shieldVsSustain",
		1,
		(a, b) => kit(a, "shield") && kit(b, "duel") && b.sustain === 3,
	],
	["tankShred", 2, tankShred],
	["resistVsDamage", 2, resistVsDamage],
	[
		"splitDuel",
		2,
		(a, b) =>
			has(a, "splitpush") &&
			kit(a, "duel") &&
			!has(b, "splitpush") &&
			!kit(b, "duel"),
	],
	["tankVsBurst", 1, (a, b) => tank(a) && b.frontline <= 3 && assassin(b)],
	[
		"invadeVsFarm",
		3,
		(a, b, role) =>
			role === "jungle" &&
			a.power === "early" &&
			kit(a, "invade") &&
			kit(b, "farm"),
	],
	[
		"counterGank",
		1,
		(a, b, role) =>
			role === "jungle" &&
			has(a, "skirmish") &&
			a.power !== "late" &&
			(has(b, "pick") || has(b, "engage")) &&
			!has(b, "skirmish"),
	],
	["visionVsPick", 1, visionVsPick],
	[
		"engageVsEnchanter",
		2,
		(a, b, role) => role === "support" && has(a, "engage") && enchanter(b),
	],
	[
		"enchanterVsPoke",
		1,
		(a, b, role) =>
			role === "support" && enchanter(a) && !has(a, "poke") && has(b, "poke"),
	],
	[
		"pokeVsEngage",
		1,
		(a, b, role) =>
			role === "support" &&
			has(a, "poke") &&
			!has(a, "engage") &&
			has(b, "engage"),
	],
	["projectileBlock", 3, projectileBlock],
];

const teamRules: readonly Rule[] = [
	[
		"assassinVsCarry",
		3,
		(a, b) => assassin(a) && !melee(b) && carry(b) && immobile(b),
	],
	[
		"disengageVsEngage",
		2,
		(a, b) => kit(a, "disengage") && melee(b) && has(b, "engage"),
	],
	["peelVsDive", 2, (a, b) => has(a, "peel") && (diver(b) || assassin(b))],
	[
		"aoeVsGrouped",
		1,
		(a, b) =>
			kit(a, "aoe") &&
			melee(b) &&
			b.frontline <= 5 &&
			(diver(b) || has(b, "skirmish")),
	],
	[
		"engageVsPoke",
		2,
		(a, b) => has(a, "engage") && a.cc >= 7 && has(b, "poke") && immobile(b),
	],
	[
		"lockdownVsCarry",
		1,
		(a, b) => targeted(a) && a.cc >= 8 && has(b, "hypercarry") && immobile(b),
	],
	[
		"hookVsImmobile",
		3,
		(a, b) => kit(a, "hook") && !melee(b) && immobile(b) && b.frontline <= 4,
	],
	["projectileBlock", 2, projectileBlock],
	["tankShred", 1, tankShred],
	["antiHeal", 1, antiHeal],
	["lockdownVsDash", 1, lockdownVsDash],
	["visionVsPick", 1, visionVsPick],
];

const synergyRules: readonly Rule[] = [
	[
		"wombo",
		3,
		(a, b) =>
			(kit(a, "wombo") ||
				(has(a, "engage") &&
					a.cc >= 7 &&
					(a.ccKinds.includes("area") || a.ccKinds.includes("knockup")))) &&
			kit(b, "aoe"),
	],
	[
		"hypercarryPeel",
		3,
		(a, b) => has(a, "hypercarry") && (has(b, "peel") || enchanter(b)),
	],
	[
		"pokeSiege",
		2,
		(a, b) => has(a, "poke") && (kit(b, "disengage") || kit(b, "siege")),
	],
	["chainCc", 1, (a, b) => a.cc >= 7 && b.cc >= 7],
	[
		"knockupUlt",
		4,
		(a, b) => kit(a, "knockupUlt") && b.ccKinds.includes("knockup"),
	],
	[
		"pickVision",
		2,
		(a, b) =>
			has(a, "pick") &&
			(kit(b, "vision") ||
				(b.cc >= 6 && b.range === "long" && b.ccKinds.includes("skillshot"))),
	],
	[
		"splitPressure",
		2,
		(a, b) => has(a, "splitpush") && (kit(b, "siege") || kit(b, "disengage")),
	],
	[
		"damageMix",
		1,
		(a, b) =>
			a.damage !== "utility" &&
			b.damage !== "utility" &&
			a.split[0] >= 70 &&
			b.split[1] >= 70,
	],
	["diveTogether", 1, (a, b) => has(a, "dive") && has(b, "dive")],
	[
		"enchanterDiver",
		2,
		(a, b) => enchanter(a) && melee(b) && (diver(b) || has(b, "skirmish")),
	],
	["frontToBack", 1, (a, b) => tank(a) && !melee(b) && carry(b)],
];

type Hit = { reason: ChampionReason; points: number };
const priorityOrder = (a: Hit, b: Hit) =>
	Math.abs(b.points) - Math.abs(a.points);
const total = (hits: readonly Hit[]) =>
	hits.reduce((sum, hit) => sum + hit.points, 0);

function counterHits(
	rules: readonly Rule[],
	a: RuleProfile,
	b: RuleProfile,
	role?: Role,
): Hit[] {
	return rules.flatMap(([reason, points, applies]) => {
		const net = Number(applies(a, b, role)) - Number(applies(b, a, role));
		return net ? [{ reason, points: points * net }] : [];
	});
}

export const laneHits = (a: RuleProfile, b: RuleProfile, role: Role) =>
	counterHits(laneRules, a, b, role);
export const teamHits = (a: RuleProfile, b: RuleProfile) =>
	counterHits(teamRules, a, b);

type Roles = ReadonlySet<Role>;
export function synergyHits(
	a: RuleProfile,
	b: RuleProfile,
	rolesA: Roles,
	rolesB: Roles,
): Hit[] {
	const hits = synergyRules.flatMap(([reason, points, applies]) =>
		applies(a, b) || applies(b, a) ? [{ reason, points }] : [],
	);
	const support =
		rolesA.has("bot") && rolesB.has("support")
			? b
			: rolesB.has("bot") && rolesA.has("support")
				? a
				: undefined;
	if (support && a.power === "early" && b.power === "early")
		hits.push({ reason: "earlyDuo", points: 2 });
	if (
		support &&
		a.power === "late" &&
		b.power === "late" &&
		(enchanter(support) || has(support, "peel"))
	)
		hits.push({ reason: "scalingDuo", points: 2 });
	return hits;
}

export const pairPriorGames = 20;

export function score(
	hits: Hit[],
	factor: number,
	priorGames: number,
	sample?: { games: number; wins: number },
) {
	const prior = Math.max(-6, Math.min(6, total(hits)));
	const { games, wins } = sample ?? { games: 0, wins: 0 };
	// Keep the numerator integral until the final rounding. An exact half must
	// round away from zero even when the win rate itself has no exact decimal.
	const numerator = priorGames * prior + (factor / 2) * (2 * wins - games);
	const value =
		Math.sign(numerator) *
			Math.round(Math.abs(numerator) / (games + priorGames)) || 0;
	const reasons = hits
		.filter(({ points }) => points * value > 0)
		.sort(priorityOrder)
		.map(({ reason }) => reason);
	return { value, ...(reasons.length ? { reasons } : {}) };
}
