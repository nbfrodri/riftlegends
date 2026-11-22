import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import {
	PLAYER_ATTRIBUTES,
	type PlayerAttribute,
} from "../../packages/contracts/draft/player-attributes.ts";
import { leagueStrength } from "./league-strength.ts";
import { groupBy } from "./normalization.ts";

type Game = RealSnapshot["games"][number];
type Line = Game["lines"][number];
export type Role = NonNullable<Line["role"]>;
type AttributeScores = Record<PlayerAttribute, number>;
type Metric = keyof typeof measurements;
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

// Fórmulas por partida. Las tasas usan minutos jugados y KP es (K+A)/bajas
// del equipo. Las sumas ponderadas ponen sus componentes en escalas similares.
const measurements = {
	lanes: (r: Rates) => blend(r.cs, r.gold, 1 / 60), // CS/min + oro/min ÷ 60
	farming: (r: Rates) => r.cs, // CS/min
	waves: (r: Rates) => r.cs, // Proxy de gestión de oleadas basado en CS/min
	macro: (r: Rates) => blend(r.vision, r.kp, 2), // Visión/min + 2 × KP
	roaming: (r: Rates) => blend(r.assists, r.kp, 0.5), // Asistencias/min + 0,5 × KP
	vision: (r: Rates) => r.vision, // Visión/min
	anticipation: (r: Rates) => blend(r.vision, r.deaths, -4), // Visión/min − 4 × muertes/min
	objectiveControl: (r: Rates) => blend(r.vision, r.kp, 1), // Visión/min + KP
	teamfight: (r: Rates) => blend(r.share, r.kp, 0.25), // Cuota de daño + 0,25 × KP
	mechanics: (r: Rates) => blend(r.damage, r.share, 1000), // Daño/min + 1000 × cuota de daño
	positioning: (r: Rates) => (r.deaths === undefined ? undefined : -r.deaths), // −muertes/min
	aggression: (r: Rates) => blend(r.kills, r.kp, 0.3), // Bajas/min + 0,3 × KP (sin tiempos de bajas)
};

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

function describe(rows: { line: Line; rates: Rates; won?: boolean }[]) {
	const stats: Partial<Record<PlayerAttribute, Observation | undefined>> = {};
	for (const [attribute, measure] of Object.entries(measurements))
		stats[attribute as Metric] = observe(rows.map((row) => measure(row.rates)));
	// Constancia: coeficiente de variación del daño/min invertido (≥2 partidas).
	stats.consistency = observe(
		rows.map((row) => row.rates.damage),
		(damage) => {
			const mean = average(damage);
			return mean === 0
				? 0
				: -Math.sqrt(average(damage.map((d) => (d - mean) ** 2))) / mean;
		},
		2,
	);
	// Versatilidad: 1 − suma de las cuotas de uso de cada campeón al cuadrado.
	const known = rows.flatMap(({ line }) => line.champion ?? []);
	const picks = groupBy(known, (id) => id);
	stats.versatility = observe(
		known.map((id) => (picks.get(id)?.length ?? 0) / known.length),
		(shares) => 1 - average(shares),
	);
	const results = rows.flatMap(({ won }) =>
		won === undefined ? [] : [Number(won)],
	);
	return {
		stats,
		games: rows.length,
		// Centrada en cero, con 12 partidas previas al 50 %.
		result:
			results.reduce((total, win) => total + 2 * win - 1, 0) /
			(results.length + 12),
	};
}

const roleMean = 65;

// Percentil de rango medio dentro del rol y liga. La media de los rangos es
// 0,5, que se lleva a 65. Cada métrica vuelve hacia 65 con 12 partidas previas.
function percentile(data: Observation, cohort: readonly Observation[]) {
	const relativeRank = cohort.reduce(
		(rank, peer) =>
			rank +
			(peer.value < data.value ? 1 : peer.value === data.value ? 0.5 : 0),
		0,
	);
	const offset = 60 * (relativeRank / cohort.length - 0.5);
	return roleMean + (offset * data.samples) / (data.samples + 12);
}

export function attributeProfiles(snapshot: RealSnapshot) {
	const rows = [...snapshot.games]
		.sort((a, b) => (a.id < b.id ? -1 : Number(a.id !== b.id)))
		.flatMap((game) => {
			const sides = groupBy(game.lines, (line) => line.team);
			return game.lines.flatMap((line) =>
				line.role
					? [
							{
								line,
								role: line.role,
								rates: rates(game, line, sides.get(line.team) ?? []),
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

	const strength = leagueStrength[snapshot.league.id] ?? 1;
	return (player: string, role: Role) => {
		const cohort = cohorts.get(role);
		const profile = cohort?.get(player);
		const estimated: PlayerAttribute[] = [];
		// Experiencia: volumen de 2026 suavizado. El ajuste se centra en la media del rol.
		const exposure = (games: number) => games / (games + 12);
		const typicalExposure = cohort
			? average(Array.from(cohort.values(), ({ games }) => exposure(games)))
			: 0;
		const experience = profile ? exposure(profile.games) - typicalExposure : 0;
		const values = PLAYER_ATTRIBUTES.map((attribute) => {
			const measured = profile?.stats[attribute];
			let value = roleMean;
			if (measured && cohort) {
				const population = Array.from(cohort.values()).flatMap(
					({ stats }) => stats[attribute] ?? [],
				);
				value = percentile(measured, population);
			} else if (attribute === "experience") {
				value += 24 * experience;
			} else if (attribute in mental) {
				const [experienceWeight, resultWeight] =
					mental[attribute as keyof typeof mental];
				value +=
					experienceWeight * experience + resultWeight * (profile?.result ?? 0);
			}
			if (!measured || proxies.has(attribute)) estimated.push(attribute);
			return [
				attribute,
				Math.round(Math.max(0, Math.min(100, value * strength))),
			] as const;
		});
		return {
			attributes: Object.fromEntries(values) as AttributeScores,
			estimated,
		};
	};
}
