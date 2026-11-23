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
const tiers = [
	[70, "S+"],
	[45, "S"],
	[30, "A"],
	[10, "B"],
	[0.25, "C"],
] as const;
type Tier = (typeof tiers)[number][1] | "D";
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

export function positions(
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
		const tier: Tier =
			tiers.find(([threshold]) => score >= threshold)?.[1] ?? "D";
		return { role, tier, samples };
	});
	return observed
		.filter(
			({ role, samples }) =>
				profile.roles.includes(role) || (samples > 0 && samples * 20 >= picks),
		)
		.sort((a, b) => b.samples - a.samples)
		.map(({ role, tier }) => ({ role, tier }));
}
