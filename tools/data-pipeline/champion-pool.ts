import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { Role } from "./attributes.ts";
import { compare } from "./queries.ts";

type Game = RealSnapshot["games"][number];

const poolSize = 3;
const maxMains = 3;
const maxSecondary = 5;

/** Mastery from games played: 40 with none, rising towards 90. Fillers get 30. */
const masteryFrom = (games: number) =>
	Math.round(40 + (50 * games) / (games + 6));
const fillerMastery = 30;

export const byGames = (a: [string, number], b: [string, number]) =>
	b[1] - a[1] || compare(a[0], b[0]);

export function rolePools(games: readonly Game[]) {
	const counts = new Map<Role, Map<string, number>>();
	for (const line of games.flatMap((game) => game.lines)) {
		if (!line.role || !line.champion) continue;
		const roleCounts = counts.get(line.role) ?? new Map<string, number>();
		roleCounts.set(line.champion, (roleCounts.get(line.champion) ?? 0) + 1);
		counts.set(line.role, roleCounts);
	}
	return (role: Role) =>
		[...(counts.get(role) ?? [])].sort(byGames).map(([id]) => id);
}

export function pool(played: [string, number][], fillers: readonly string[]) {
	const known = new Set(played.map(([id]) => id));
	const extra = fillers.filter((id) => !known.has(id));
	const total = played.reduce((sum, [, games]) => sum + games, 0);
	const value = new Map(
		played.map(([champion, games]) => [champion, masteryFrom(games)]),
	);
	if (played.length === 0) {
		const [a, b, c, d, e] = extra;
		return {
			mains: [a, b].flatMap((id) => id ?? []),
			secondary: [c, d].flatMap((id) => id ?? []),
			weak: e ? [e] : [],
			mastery: extra
				.slice(0, 5)
				.map((champion) => ({ champion, value: fillerMastery })),
		};
	}
	const mains = played
		.filter(
			([, games], index) => index === 0 || (games >= 3 && games / total >= 0.2),
		)
		.slice(0, maxMains);
	const weak = extra.slice(0, Math.max(1, poolSize - played.length));
	const secondary = played
		.slice(mains.length, mains.length + maxSecondary)
		.map(([id]) => id);
	const named = [...mains.map(([id]) => id), ...secondary];
	return {
		mains: mains.map(([id]) => id),
		secondary,
		weak,
		mastery: [
			...named.map((champion) => ({
				champion,
				value: value.get(champion) ?? fillerMastery,
			})),
			...weak.map((champion) => ({ champion, value: fillerMastery })),
		],
	};
}
