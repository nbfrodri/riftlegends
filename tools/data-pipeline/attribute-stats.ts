import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { PlayerAttribute } from "../../packages/contracts/draft/player-attributes.ts";
import { groupBy } from "./normalization.ts";

type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
type Rates = ReturnType<typeof rates>;
export type Observation = { samples: number; value: number };

function ratio(numerator: number | undefined, denominator: number | undefined) {
	if (numerator === undefined || denominator === undefined) return undefined;
	return denominator > 0 ? numerator / denominator : undefined;
}

function sum(values: (number | undefined)[]) {
	return values.every((value) => value !== undefined)
		? values.reduce<number>((total, value) => total + (value ?? 0), 0)
		: undefined;
}

export function rates(game: Game, line: Line, allies: Line[]) {
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
export const recipes: Partial<
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
export const resultPoints: Partial<Record<PlayerAttribute, number>> = {
	macro: 6,
	anticipation: 6,
	objectiveControl: 6,
	teamfight: 6,
	positioning: 6,
	consistency: 4,
};
export const defaultResultPoints = 3;

export const proxies = new Set<PlayerAttribute>([
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
export const mental = {
	composure: [4, 6],
	resilience: [4, 3],
	focus: [5, 2],
	shotcalling: [7, 5],
	communication: [6, 3],
} as const;

// Puntos que suma la trayectoria completa (careerStrength = 1) a los atributos
// que dependen de haber vivido muchas temporadas y finales.
export const careerPoints: Partial<Record<PlayerAttribute, number>> = {
	experience: 20,
	composure: 6,
	resilience: 5,
	consistency: 4,
};

export const average = (values: number[]) =>
	values.reduce((total, value) => total + value, 0) / values.length;

function observe(values: (number | undefined)[], score = average, minimum = 1) {
	const present = values.filter(
		(value): value is number => value !== undefined,
	);
	return present.length < minimum
		? undefined
		: { samples: present.length, value: Math.round(score(present) * 10_000) };
}

export function describe(
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
