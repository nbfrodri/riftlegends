import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import {
	PLAYER_ATTRIBUTES,
	type PlayerAttribute,
} from "../../packages/contracts/draft/player-attributes.ts";
import { careerLevelCap } from "./career.ts";
import { leagueOffset } from "./league-strength.ts";
import { groupBy } from "./normalization.ts";

type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
export type Role = NonNullable<Line["role"]>;
type AttributeScores = Record<PlayerAttribute, number>;
type Rates = ReturnType<typeof rates>;
type Observation = { samples: number; value: number };

function ratio(numerator: number | undefined, denominator: number | undefined) {
	if (numerator === undefined || denominator === undefined) return undefined;
	return denominator > 0 ? numerator / denominator : undefined;
}

function sum(values: (number | undefined)[]) {
	return values.every((value) => value !== undefined)
		? values.reduce<number>((total, value) => total + (value ?? 0), 0)
		: undefined;
}

function rates(game: Game, line: Line, allies: Line[]) {
	const minutes = (game.lengthSeconds ?? 0) / 60;
	return {
		cs: ratio(line.cs, minutes),
		gold: ratio(line.gold, minutes),
		vision: ratio(line.visionScore, minutes),
		kills: ratio(line.kills, minutes),
		assists: ratio(line.assists, minutes),
		deaths: ratio(line.deaths, minutes),
		damage: ratio(line.damageToChampions, minutes),
		share:
			allies.length === 5
				? ratio(
						line.damageToChampions,
						sum(allies.map((row) => row.damageToChampions)),
					)
				: undefined,
		kp:
			allies.length === 5
				? ratio(
						sum([line.kills, line.assists]),
						sum(allies.map((row) => row.kills)),
					)
				: undefined,
	};
}

function blend(a: number | undefined, b: number | undefined, weight: number) {
	return a === undefined || b === undefined ? undefined : a + b * weight;
}

// Métricas por partida. Las tasas usan minutos jugados y KP es (K+A)/bajas
// del equipo. Cada atributo mezcla varias (ver `recipes`).
const metrics = {
	csGold: (r: Rates) => blend(r.cs, r.gold, 1 / 60), // CS/min + oro/min ÷ 60
	cs: (r: Rates) => r.cs, // CS/min
	vision: (r: Rates) => r.vision, // Visión/min
	kp: (r: Rates) => r.kp, // Participación en bajas
	assists: (r: Rates) => r.assists, // Asistencias/min
	kills: (r: Rates) => r.kills, // Bajas/min
	survival: (r: Rates) => (r.deaths === undefined ? undefined : -r.deaths), // −muertes/min
	share: (r: Rates) => r.share, // Cuota de daño del equipo
	damage: (r: Rates) => r.damage, // Daño/min
};
type Metric = keyof typeof metrics;

// Cada atributo medido es la media ponderada de los percentiles de sus
// métricas (rol y liga). Así ninguna métrica ruidosa decide sola.
const recipes: Partial<
	Record<
		PlayerAttribute,
		Partial<Record<Metric | "spread" | "steadiness", number>>
	>
> = {
	lanes: { csGold: 1 },
	farming: { cs: 1 },
	waves: { cs: 0.6, csGold: 0.4 },
	macro: { vision: 0.35, kp: 0.35, survival: 0.3 },
	roaming: { assists: 0.5, kp: 0.5 },
	vision: { vision: 1 },
	anticipation: { vision: 0.4, survival: 0.6 },
	objectiveControl: { vision: 0.5, kp: 0.5 },
	teamfight: { kp: 0.35, share: 0.25, survival: 0.25, assists: 0.15 },
	mechanics: { damage: 0.5, share: 0.25, kills: 0.25 },
	positioning: { survival: 0.7, kp: 0.3 },
	aggression: { kills: 0.6, kp: 0.4 },
	consistency: { steadiness: 0.6, survival: 0.4 },
	versatility: { spread: 1 },
};

// Puntos que suman o restan los resultados del equipo (en juego de equipo
// pesan más). Los playoffs cuentan doble.
const resultPoints: Partial<Record<PlayerAttribute, number>> = {
	macro: 6,
	anticipation: 6,
	objectiveControl: 6,
	teamfight: 6,
	positioning: 6,
	consistency: 4,
};
const defaultResultPoints = 3;

const proxies = new Set<PlayerAttribute>([
	"lanes",
	"waves",
	"macro",
	"roaming",
	"anticipation",
	"objectiveControl",
	"teamfight",
	"mechanics",
	"positioning",
	"aggression",
	"consistency",
]);

// Temple, resistencia, concentración, shotcalling y comunicación parten de
// la media del rol y liga. Cada par pesa experiencia y resultados, en ese orden.
const mental = {
	composure: [4, 6],
	resilience: [4, 3],
	focus: [5, 2],
	shotcalling: [7, 5],
	communication: [6, 3],
} as const;

// Puntos que suma la trayectoria completa (careerStrength = 1) a los atributos
// que dependen de haber vivido muchas temporadas y finales.
const careerPoints: Partial<Record<PlayerAttribute, number>> = {
	experience: 20,
	composure: 6,
	resilience: 5,
	consistency: 4,
};

const average = (values: number[]) =>
	values.reduce((total, value) => total + value, 0) / values.length;

function observe(values: (number | undefined)[], score = average, minimum = 1) {
	const present = values.filter(
		(value): value is number => value !== undefined,
	);
	return present.length < minimum
		? undefined
		: { samples: present.length, value: Math.round(score(present) * 10_000) };
}

function describe(
	rows: { line: Line; rates: Rates; won?: boolean; weight: number }[],
) {
	const stats: Partial<Record<string, Observation | undefined>> = {};
	for (const [name, measure] of Object.entries(metrics))
		stats[name] = observe(rows.map((row) => measure(row.rates)));
	// Estabilidad: coeficiente de variación del daño/min invertido (≥2 partidas).
	stats.steadiness = observe(
		rows.map((row) => row.rates.damage),
		(damage) => {
			const mean = average(damage);
			return mean === 0
				? 0
				: -Math.sqrt(average(damage.map((d) => (d - mean) ** 2))) / mean;
		},
		2,
	);
	// Variedad: 1 − suma de las cuotas de uso de cada campeón al cuadrado.
	const known = rows.flatMap(({ line }) => line.champion ?? []);
	const picks = groupBy(known, (id) => id);
	stats.spread = observe(
		known.map((id) => (picks.get(id)?.length ?? 0) / known.length),
		(shares) => 1 - average(shares),
	);
	const results = rows.flatMap(({ won, weight }) =>
		won === undefined ? [] : [{ won, weight }],
	);
	return {
		stats,
		games: rows.length,
		// Centrado en cero, con 12 partidas previas al 50 %.
		result:
			results.reduce(
				(total, { won, weight }) => total + weight * (2 * Number(won) - 1),
				0,
			) /
			(results.reduce((total, { weight }) => total + weight, 0) + 12),
	};
}

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
 * atributos. La trayectoria (0–1, ver `careerStrength`) suma hasta
 * `careerLevelCap` puntos.
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
	return Math.round(
		Math.max(
			30,
			Math.min(
				99,
				center + 1.25 * (total / weights - center) + careerLevelCap * career,
			),
		),
	);
}

const playoffWeight = 2;

export function attributeProfiles(snapshot: RealSnapshot) {
	const playoffs = new Set(
		snapshot.tournaments
			.filter((tournament) => /playoff/i.test(tournament.name))
			.map((tournament) => tournament.id),
	);
	const rows = [...snapshot.games]
		.sort((a, b) => (a.id < b.id ? -1 : Number(a.id !== b.id)))
		.flatMap((game) => {
			const sides = groupBy(game.lines, (line) => line.team);
			const weight = playoffs.has(game.tournament) ? playoffWeight : 1;
			return game.lines.flatMap((line) =>
				line.role
					? [
							{
								line,
								role: line.role,
								rates: rates(game, line, sides.get(line.team) ?? []),
								weight,
								...(game.winner ? { won: line.team === game.winner } : {}),
							},
						]
					: [],
			);
		});
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
		// Experiencia: partidas de 2026 suavizadas, centradas en la media del rol.
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
			value += (careerPoints[attribute] ?? 0) * career;
			if (!measured || proxies.has(attribute)) estimated.push(attribute);
			return [
				attribute,
				Math.round(Math.max(40, Math.min(97, value + offset))),
			] as const;
		});
		return {
			attributes: Object.fromEntries(values) as AttributeScores,
			estimated,
		};
	};
}
