import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import {
	PLAYER_ATTRIBUTES,
	type PlayerAttribute,
} from "../../packages/contracts/draft/player-attributes.ts";
import {
	average,
	careerPoints,
	defaultResultPoints,
	describe,
	mental,
	type Observation,
	proxies,
	rates,
	recipes,
	resultPoints,
} from "./attribute-stats.ts";
import { careerLevelShare, levelCeiling } from "./career.ts";
import { leagueOffset } from "./league-strength.ts";
import { groupBy, idResolver } from "./normalization.ts";
import { compare } from "./queries.ts";
import { minPlayerGames } from "./season.ts";

type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
export type Role = NonNullable<Line["role"]>;
type AttributeScores = Record<PlayerAttribute, number>;

/** Banda profesional: el percentil 0 vale 55 y el 100 vale 88 (centro 71,5). */
export const bandFloor = 55;
export const bandSpan = 33;
export const bandValue = (percentile: number) =>
	bandFloor + bandSpan * percentile;

/**
 * Percentil de rango medio (0–1) dentro del rol y liga que vuelve hacia 0,5
 * con 12 partidas previas.
 */
export function shrunkPercentile(
	data: Observation,
	cohort: readonly Observation[],
) {
	const rank = cohort.reduce(
		(total, peer) =>
			total +
			(peer.value < data.value ? 1 : peer.value === data.value ? 0.5 : 0),
		0,
	);
	return (
		0.5 + ((rank / cohort.length - 0.5) * data.samples) / (data.samples + 12)
	);
}

const roleFocus: Record<Role, readonly PlayerAttribute[]> = {
	top: ["lanes", "waves", "farming", "teamfight", "positioning", "composure"],
	jungle: [
		"macro",
		"objectiveControl",
		"roaming",
		"anticipation",
		"vision",
		"shotcalling",
	],
	mid: ["lanes", "mechanics", "roaming", "teamfight", "waves", "positioning"],
	bot: [
		"farming",
		"mechanics",
		"positioning",
		"teamfight",
		"aggression",
		"lanes",
	],
	support: [
		"vision",
		"roaming",
		"communication",
		"shotcalling",
		"anticipation",
		"objectiveControl",
	],
};
const focusWeight = 3;

/**
 * Nivel: media ponderada de los 20 atributos (peso 3 en los seis del rol, 1 en
 * el resto), estirada 1,25 sobre el centro de la banda. La liga ya está en los
 * atributos. La trayectoria (0–1, ver `careerStrength`) cierra hasta
 * la mitad de la distancia al techo `levelCeiling` (94).
 */
export function playerLevel(
	attributes: AttributeScores,
	role: Role,
	career = 0,
) {
	let total = 0;
	let weights = 0;
	for (const key of PLAYER_ATTRIBUTES) {
		const weight = roleFocus[role].includes(key) ? focusWeight : 1;
		total += weight * attributes[key];
		weights += weight;
	}
	const center = bandValue(0.5);
	const raw = center + 1.25 * (total / weights - center);
	// The career closes part of the gap to the ceiling, so stars barely move.
	const level =
		raw + careerLevelShare * career * Math.max(0, levelCeiling - raw);
	return Math.round(
		Math.max(30, Math.min(career > 0 ? levelCeiling : 99, level)),
	);
}

const playoffWeight = 2;

export function attributeProfiles(snapshot: RealSnapshot) {
	const playoffs = new Set(
		snapshot.tournaments
			.filter((tournament) => /playoff/i.test(tournament.name))
			.map((tournament) => tournament.id),
	);
	const rowsOf = (games: readonly Game[]) =>
		[...games]
			.sort((a, b) => compare(a.id, b.id))
			.flatMap((game) => {
				const sides = groupBy(game.lines, (line) => line.team);
				const weight = playoffs.has(game.tournament) ? playoffWeight : 1;
				return game.lines.flatMap((line) =>
					line.role
						? [
								{
									line,
									role: line.role,
									date: game.date,
									rates: rates(game, line, sides.get(line.team) ?? []),
									weight,
									...(game.winner ? { won: line.team === game.winner } : {}),
								},
							]
						: [],
				);
			});
	const rows = rowsOf(snapshot.games);
	// Fill the sample with each returning player's latest previous games.
	const played = new Map<string, number>();
	for (const { line } of rows)
		played.set(line.player, (played.get(line.player) ?? 0) + 1);
	const resolve = idResolver(snapshot.seasonPlayers.map(({ id }) => id));
	for (const row of rowsOf(snapshot.previousGames ?? []).sort((a, b) =>
		compare(b.date, a.date),
	)) {
		const player = resolve(row.line.player);
		if (player === undefined) continue;
		const count = played.get(player) ?? 0;
		if (count >= minPlayerGames) continue;
		played.set(player, count + 1);
		rows.push({ ...row, line: { ...row.line, player } });
	}
	const cohorts = new Map<Role, Map<string, ReturnType<typeof describe>>>();
	for (const [role, roleRows] of groupBy(rows, (row) => row.role)) {
		cohorts.set(
			role as Role,
			new Map(
				Array.from(
					groupBy(roleRows, ({ line }) => line.player),
					([id, lines]) => [id, describe(lines)],
				),
			),
		);
	}

	const offset = leagueOffset[snapshot.league.id] ?? 0;
	return (player: string, role: Role, career = 0) => {
		const cohort = cohorts.get(role);
		const profile = cohort?.get(player);
		const estimated: PlayerAttribute[] = [];
		// Experience: smoothed game counts centered on the role average.
		const exposure = (games: number) => games / (games + 12);
		const typicalExposure = cohort
			? average(Array.from(cohort.values(), ({ games }) => exposure(games)))
			: 0;
		const experience = profile ? exposure(profile.games) - typicalExposure : 0;
		const result = profile?.result ?? 0;
		const center = bandValue(0.5);
		const values = PLAYER_ATTRIBUTES.map((attribute) => {
			let value = center;
			let measured = false;
			const recipe = recipes[attribute];
			if (recipe && profile && cohort) {
				let total = 0;
				let weights = 0;
				for (const [metric, weight] of Object.entries(recipe)) {
					const data = profile.stats[metric];
					if (!data) continue;
					const peers = Array.from(cohort.values()).flatMap(
						({ stats }) => stats[metric] ?? [],
					);
					total += weight * shrunkPercentile(data, peers);
					weights += weight;
				}
				if (weights > 0) {
					value = bandValue(total / weights);
					measured = true;
				}
			}
			if (measured) {
				value += (resultPoints[attribute] ?? defaultResultPoints) * 2 * result;
			} else if (attribute === "experience") {
				value += 24 * experience;
			} else if (attribute in mental) {
				const [experienceWeight, resultWeight] =
					mental[attribute as keyof typeof mental];
				value += experienceWeight * experience + resultWeight * result;
			}
			const base = Math.round(Math.max(40, Math.min(97, value + offset)));
			const boosted = value + offset + (careerPoints[attribute] ?? 0) * career;
			if (!measured || proxies.has(attribute)) estimated.push(attribute);
			// With a career the attribute stops at 95, but never drops below its base.
			return [
				attribute,
				career > 0 ? Math.max(base, Math.round(Math.min(95, boosted))) : base,
			] as const;
		});
		return {
			attributes: Object.fromEntries(values) as AttributeScores,
			estimated,
		};
	};
}
