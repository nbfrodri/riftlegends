import type { AiContent, Role } from "@rift-legends/contracts";
import { ROLES } from "@rift-legends/contracts";

type Champion = AiContent["champions"][number];

/**
 * A champion as the detector reads it: the archetypes and power of the shared
 * content, plus the optional kit facts of the game data (#340). A missing or
 * unknown kit trait counts for nothing.
 */
export interface IdentityChampion {
	readonly id: string;
	readonly archetypes: Champion["archetypes"];
	readonly power: Champion["power"];
	/** Kit traits such as `siege`, `wombo`, `aoe`, `hook`, `duel` or `vision`. */
	readonly kit?: readonly string[] | undefined;
	/** CC kinds of the kit (`targeted`, `knockup`, ...). */
	readonly ccKinds?: readonly string[] | undefined;
	readonly positions?: readonly Role[] | undefined;
}

/** A confirmed pick. Without `role` (flex), the detector assigns one. */
export interface IdentityPick {
	readonly champion: IdentityChampion;
	readonly role?: Role | undefined;
}

const IDENTITY_IDS = [
	"backline",
	"collapse",
	"dive",
	"earlyTempo",
	"lateScaling",
	"ambush",
	"sidelanes",
	"siege",
] as const;
type IdentityId = (typeof IDENTITY_IDS)[number];

interface IdentityPlan {
	readonly id: IdentityId;
	readonly threshold: number;
	/** Distinct champions with some signal of the plan. */
	readonly count: number;
	readonly contributors: readonly string[];
	/** Required functions and whether the team covers them. */
	readonly requirements: readonly { key: string; met: boolean }[];
	/** `count` reaches `threshold` and every requirement is met. */
	readonly active: boolean;
}

export interface Identities {
	readonly primary: IdentityId | null;
	readonly secondary: IdentityId | null;
	/** Every plan, in id order, with the evidence for the decision. */
	readonly plans: readonly IdentityPlan[];
	/** Role of each champion (fixed picks and the stable flex assignment). */
	readonly assignments: Readonly<Partial<Record<Role, string>>>;
	/** Fewer than five picks: the result may still change. */
	readonly complete: boolean;
}

type Traits = ReadonlySet<string>;
type Slot = (traits: Traits) => boolean;
interface Member {
	readonly id: string;
	readonly traits: Traits;
	readonly role: Role | undefined;
}

const has =
	(...names: string[]): Slot =>
	(t) =>
		names.some((n) => t.has(n));
const hasAll =
	(...names: string[]): Slot =>
	(t) =>
		names.every((n) => t.has(n));
const targetedCc = has("cc:targeted", "cc:knockup");

interface Rule {
	readonly id: IdentityId;
	readonly threshold: number;
	readonly signal: Slot;
	readonly requirements: readonly {
		readonly key: string;
		readonly met: (team: readonly Member[]) => boolean;
	}[];
}

/** True when every slot can be filled by a different champion. */
function fillsDistinct(team: readonly Member[], slots: readonly Slot[]) {
	const fill = (index: number, used: ReadonlySet<number>): boolean =>
		index === slots.length ||
		team.some(
			(member, i) =>
				!used.has(i) &&
				(slots[index] as Slot)(member.traits) &&
				fill(index + 1, new Set([...used, i])),
		);
	return fill(0, new Set());
}
const distinct = (key: string, ...slots: Slot[]) => ({
	key,
	met: (team: readonly Member[]) => fillsDistinct(team, slots),
});
const some = (key: string, slot: Slot) => ({
	key,
	met: (team: readonly Member[]) => team.some((m) => slot(m.traits)),
});

const lateCarry = hasAll("power:late", "carry");
const lateHyper = hasAll("power:late", "hypercarry");
const sideLaner = has("splitpush", "duel");

/** The plan table of plan 08 (Ampliación 23-11), in id order. */
const RULES: readonly Rule[] = [
	{
		id: "ambush",
		threshold: 2,
		signal: (t) =>
			has("pick", "hook")(t) || targetedCc(t) || hasAll("utility", "vision")(t),
		requirements: [
			distinct(
				"ambushOpener",
				has("pick", "hook"),
				(t) => targetedCc(t) || hasAll("utility", "vision")(t),
			),
		],
	},
	{
		id: "backline",
		threshold: 3,
		signal: has(
			"tank",
			"carry",
			"hypercarry",
			"peel",
			"disengage",
			"enchanter",
		),
		requirements: [
			distinct(
				"backlineCore",
				has("tank"),
				has("carry", "hypercarry"),
				has("peel", "disengage", "enchanter"),
			),
		],
	},
	{
		id: "collapse",
		threshold: 3,
		signal: has("engage", "wombo", "aoe"),
		requirements: [
			distinct("collapseCore", has("engage", "wombo"), has("aoe", "wombo")),
		],
	},
	{
		id: "dive",
		threshold: 3,
		signal: has("dive", "engage", "skirmish"),
		requirements: [
			distinct("diveCore", has("dive"), has("dive"), has("engage", "skirmish")),
		],
	},
	{
		id: "earlyTempo",
		threshold: 3,
		signal: has("power:early", "invade", "skirmish"),
		requirements: [
			distinct("earlyPeaks", has("power:early"), has("power:early")),
			some("earlyReach", has("invade", "skirmish")),
		],
	},
	{
		id: "lateScaling",
		threshold: 3,
		signal: has("power:late", "hypercarry", "peel"),
		requirements: [
			distinct("latePeaks", has("power:late"), has("power:late")),
			distinct(
				"lateCore",
				(t) => lateCarry(t) || lateHyper(t),
				has("power:late"),
				has("peel"),
			),
		],
	},
	{
		id: "sidelanes",
		threshold: 3,
		signal: has("splitpush", "duel", "siege", "disengage"),
		requirements: [], // Needs roles: see `sidelanesMet`.
	},
	{
		id: "siege",
		threshold: 3,
		signal: has("poke", "siege"),
		requirements: [
			distinct("pokers", has("poke"), has("poke")),
			some("siegeReach", has("siege")),
		],
	},
];

function traitsOf({ champion }: IdentityPick): Traits {
	return new Set([
		...champion.archetypes,
		...(champion.kit ?? []),
		...(champion.ccKinds ?? []).map((k) => `cc:${k}`),
		`power:${champion.power}`,
	]);
}

/**
 * Stable legal roles: fixed picks keep theirs and the flex picks, by id, take
 * the first free position in `ROLES` order that lets most picks play. A pick
 * that cannot be placed stays without role.
 */
function assignRoles(picks: readonly IdentityPick[]) {
	const roles = new Map<string, Role>();
	const taken = new Set<Role>();
	for (const { champion, role } of picks) {
		if (role && !taken.has(role)) {
			roles.set(champion.id, role);
			taken.add(role);
		}
	}
	const flex = picks
		.filter(({ champion }) => !roles.has(champion.id))
		.map(({ champion }) => champion)
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	let best: (Role | null)[] = [];
	let bestCount = -1;
	const search = (
		index: number,
		used: ReadonlySet<Role>,
		path: (Role | null)[],
	) => {
		if (index === flex.length) {
			const count = path.filter(Boolean).length;
			if (count > bestCount) {
				best = path;
				bestCount = count;
			}
			return;
		}
		const options = ROLES.filter(
			(r) => !used.has(r) && (flex[index]?.positions ?? ROLES).includes(r),
		);
		for (const role of options)
			search(index + 1, new Set([...used, role]), [...path, role]);
		search(index + 1, used, [...path, null]);
	};
	search(0, taken, []);
	flex.forEach((champion, i) => {
		const role = best[i];
		if (role) roles.set(champion.id, role);
	});
	return roles;
}

/** Top and mid can hold the side lanes (one with `splitpush`) and another champion holds the group. */
function sidelanesMet(team: readonly Member[]) {
	const top = team.find((m) => m.role === "top");
	const mid = team.find((m) => m.role === "mid");
	if (!top || !mid) return false;
	if (!sideLaner(top.traits) || !sideLaner(mid.traits)) return false;
	if (!top.traits.has("splitpush") && !mid.traits.has("splitpush"))
		return false;
	return team.some(
		(m) => m !== top && m !== mid && has("siege", "disengage")(m.traits),
	);
}

/**
 * Detects the primary and secondary identity of a team from its confirmed
 * picks (plan 08, C8). The same detector serves the draft AI and the match.
 *
 * Plans rank by how far their count exceeds the threshold, then by number of
 * contributors, then by id. No active plan means no identity.
 */
export function detectIdentities(picks: readonly IdentityPick[]): Identities {
	const roles = assignRoles(picks);
	const team: Member[] = picks.map((pick) => ({
		id: pick.champion.id,
		traits: traitsOf(pick),
		role: roles.get(pick.champion.id),
	}));
	const plans = RULES.map((rule): IdentityPlan => {
		const contributors = team
			.filter((m) => rule.signal(m.traits))
			.map((m) => m.id)
			.sort();
		const requirements = [
			...rule.requirements.map(({ key, met }) => ({ key, met: met(team) })),
			...(rule.id === "sidelanes"
				? [{ key: "sideLanes", met: sidelanesMet(team) }]
				: []),
		];
		return {
			id: rule.id,
			threshold: rule.threshold,
			count: contributors.length,
			contributors,
			requirements,
			active:
				contributors.length >= rule.threshold &&
				requirements.every((r) => r.met),
		};
	});
	const ranked = plans
		.filter((p) => p.active)
		.sort(
			(a, b) =>
				b.count - b.threshold - (a.count - a.threshold) ||
				b.count - a.count ||
				(a.id < b.id ? -1 : 1),
		);
	return {
		primary: ranked[0]?.id ?? null,
		secondary: ranked[1]?.id ?? null,
		plans,
		assignments: Object.fromEntries([...roles].map(([id, role]) => [role, id])),
		complete: picks.length === ROLES.length,
	};
}
