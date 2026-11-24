import type { ROLES } from "@rift-legends/contracts";
import type { championProfile } from "./curated-champions.ts";

type Role = (typeof ROLES)[number];
export const roles = [
	"top",
	"jungle",
	"mid",
	"bot",
	"support",
] as const satisfies typeof ROLES;
type Profile = ReturnType<typeof championProfile>;
/** Share of each role's champions per tier (cumulative cuts are rounded half up). */
const quotas = [
	["S+", 3],
	["S", 8],
	["A", 17],
	["B", 27],
	["C", 30],
	["D", 15],
] as const;
export type Tier = (typeof quotas)[number][0];
/** Weighted picks in a role under which a champion cannot rank above B. */
export const SMALL_SAMPLE = 8;
const topSmallTier = quotas.findIndex(([tier]) => tier === "B");

interface Ranked {
	id: string;
	score: number;
	samples: number;
}

/** Tiers of one role: same score for all, assigned by quota, ties broken by id. */
export function rankTiers(rows: readonly Ranked[]) {
	const sorted = [...rows].sort(
		(a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
	);
	const tiers = new Map<string, Tier>();
	let cumulative = 0;
	let next = 0;
	for (const [index, [tier, share]] of quotas.entries()) {
		cumulative += share;
		const end = Math.floor((sorted.length * cumulative + 50) / 100);
		for (; next < end; next++) {
			const row = sorted[next];
			if (!row) continue;
			const capped = row.samples < SMALL_SAMPLE && index < topSmallTier;
			tiers.set(row.id, capped ? "B" : tier);
		}
	}
	return tiers;
}
const proStyles = new Set([
	"engage",
	"peel",
	"utility",
	"tank",
	"pick",
	"poke",
]);

export interface Presence {
	picks: number;
	bans: number;
	roles: Map<Role, number>;
}

export interface SeasonPresence {
	year: number;
	games: number;
	champions: Map<string, Presence>;
}

export function recordPick(
	season: SeasonPresence,
	id: string,
	role?: Role,
	count = 1,
) {
	const presence = countsFor(season, id);
	presence.picks += count;
	if (role) presence.roles.set(role, (presence.roles.get(role) ?? 0) + count);
}

export function countsFor(season: SeasonPresence, id: string): Presence {
	const existing = season.champions.get(id);
	if (existing) return existing;
	const counts = { picks: 0, bans: 0, roles: new Map<Role, number>() };
	season.champions.set(id, counts);
	return counts;
}

export function tierSeasons(
	seasons: Iterable<SeasonPresence>,
	current: number,
) {
	return [...seasons]
		.filter(
			({ year, games }) => games > 0 && year <= current && year >= current - 2,
		)
		.sort((a, b) => a.year - b.year)
		.map((season) => ({ ...season, weight: 0.5 ** (current - season.year) }));
}

export function scorePositions(
	id: string,
	profile: Profile,
	seasons: ReturnType<typeof tierSeasons>,
) {
	const first = seasons.find(
		({ champions }) => (champions.get(id)?.picks ?? 0) > 0,
	);
	const window = first ? seasons.filter(({ year }) => year >= first.year) : [];
	const weights = window.reduce((sum, { weight }) => sum + weight, 0);
	const picks = window.reduce(
		(sum, { champions, weight }) =>
			sum + (champions.get(id)?.picks ?? 0) * weight,
		0,
	);
	const prior =
		profile.estimate === "class" ||
		profile.roles.length > 1 ||
		profile.kit.includes("competitive") ||
		profile.archetypes.some((style) => proStyles.has(style))
			? 0.5
			: 0.1;
	const roleOrder = [...new Set([...profile.roles, ...roles])];

	const observed = roleOrder.map((role) => {
		let samples = 0;
		let presence = 0;
		for (const { champions, weight, games } of window) {
			const row = champions.get(id);
			const rolePicks = row?.roles.get(role) ?? 0;
			if (!row || rolePicks === 0) continue;
			samples += rolePicks * weight;
			presence +=
				weight *
				((100 * (row.picks + row.bans)) / games) *
				(rolePicks / row.picks);
		}
		const score =
			((weights ? presence / weights : 0) * samples + 3 * prior) /
			(samples + 3);
		return { role, score, samples };
	});
	return observed
		.filter(
			({ role, samples }) =>
				profile.roles.includes(role) || (samples > 0 && samples * 20 >= picks),
		)
		.sort((a, b) => b.samples - a.samples)
		.map(({ role, score, samples }) => ({ role, score, samples }));
}
