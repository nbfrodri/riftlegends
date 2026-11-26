import type { StandingsView } from "@rift-legends/contracts";

// Where every piece of the Swiss view goes (#487): one column per round with
// its pools stacked by balance and centred, so winners climb and losers sink
// from round to round, and a last column with the qualified teams on top and
// the eliminated ones at the bottom. Pure, so the view only draws it.

type Swiss = NonNullable<StandingsView["swiss"]>;
export type SwissSeries = Swiss["rounds"][number]["series"][number];

export const CARD_H = 46;
const CARD_GAP = 4;
export const POOL_HEAD = 20;
const POOL_GAP = 14;
export const ROUND_HEAD = 26;
export const NOTE_H = 30;
export const ROW_H = 26;
const ROW_GAP = 4;
export const COL_GAP = 36;
const END_GAP = 28;

export interface PlacedPool {
	/** `round:wins-losses`, as the flow lines name it. */
	id: string;
	wins: number;
	losses: number;
	/** `null`: a round not paired yet, with a placeholder. */
	series: readonly SwissSeries[] | null;
	y: number;
	height: number;
}

export interface PlacedRound {
	round: number;
	relaxed: Swiss["rounds"][number]["relaxed"];
	x: number;
	pools: PlacedPool[];
}

export interface Flow {
	id: string;
	d: string;
}

const poolHeight = (cards: number) =>
	POOL_HEAD + cards * CARD_H + (cards - 1) * CARD_GAP;
export const listHeight = (rows: number) =>
	POOL_HEAD + rows * ROW_H + (rows - 1) * ROW_GAP;
export const rowTop = (index: number) => POOL_HEAD + index * (ROW_H + ROW_GAP);
export const cardTop = (index: number) =>
	POOL_HEAD + index * (CARD_H + CARD_GAP);

/** Balances a round can have before it is paired: 0-0, then 1-0 and 0-1… */
function expectedPools(swiss: Swiss, round: number) {
	const pools: [number, number][] = [];
	for (let wins = round - 1; wins >= 0; wins--) {
		const losses = round - 1 - wins;
		if (wins < swiss.wins && losses < swiss.losses) pools.push([wins, losses]);
	}
	return pools;
}

export function layoutSwiss(swiss: Swiss, columnWidth: number) {
	const byRound = new Map(swiss.rounds.map((round) => [round.round, round]));
	const total = Math.max(
		swiss.totalRounds,
		...swiss.rounds.map(({ round }) => round),
	);
	const notes = swiss.rounds.some(({ relaxed }) => relaxed.length > 0);
	const top = ROUND_HEAD + (notes ? NOTE_H : 0);
	const columns = Array.from({ length: total }, (_, index) => {
		const round = index + 1;
		const paired = byRound.get(round);
		const pools = paired
			? [
					...paired.series
						.reduce((map, series) => {
							const key = series.record.join("-");
							map.set(key, [...(map.get(key) ?? []), series]);
							return map;
						}, new Map<string, SwissSeries[]>())
						.values(),
				]
					.map((series) => {
						const [wins, losses] = series[0]?.record ?? [0, 0];
						return {
							wins,
							losses,
							series: series as readonly SwissSeries[] | null,
						};
					})
					.sort((a, b) => b.wins - a.wins || a.losses - b.losses)
			: expectedPools(swiss, round).map(([wins, losses]) => ({
					wins,
					losses,
					series: null,
				}));
		return { round, relaxed: paired?.relaxed ?? [], pools };
	});
	const heightOf = (pools: (typeof columns)[number]["pools"]) =>
		pools.reduce(
			(sum, pool, index) =>
				sum + poolHeight(pool.series?.length ?? 1) + (index ? POOL_GAP : 0),
			0,
		);
	const qualified = swiss.teams.filter(({ status }) => status === "qualified");
	const eliminated = swiss.teams.filter(
		({ status }) => status === "eliminated",
	);
	const endHeight =
		listHeight(Math.max(1, qualified.length)) +
		END_GAP +
		listHeight(Math.max(1, eliminated.length));
	const body = Math.max(endHeight, ...columns.map((c) => heightOf(c.pools)));
	const rounds: PlacedRound[] = columns.map((column, index) => {
		let y = top + (body - heightOf(column.pools)) / 2;
		return {
			round: column.round,
			relaxed: column.relaxed,
			x: index * (columnWidth + COL_GAP),
			pools: column.pools.map((pool) => {
				const height = poolHeight(pool.series?.length ?? 1);
				const placed = {
					...pool,
					id: `${column.round}:${pool.wins}-${pool.losses}`,
					y,
					height,
				};
				y += height + POOL_GAP;
				return placed;
			}),
		};
	});
	const endX = total * (columnWidth + COL_GAP);
	const end = {
		x: endX,
		qualified: { y: top, height: listHeight(Math.max(1, qualified.length)) },
		eliminated: {
			y: top + body - listHeight(Math.max(1, eliminated.length)),
			height: listHeight(Math.max(1, eliminated.length)),
		},
	};
	const curve = (x1: number, y1: number, x2: number, y2: number) => {
		const mid = (x1 + x2) / 2;
		return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
	};
	const anchor = (pool: PlacedPool) => pool.y + POOL_HEAD / 2;
	const flows: Flow[] = [];
	for (const [index, column] of rounds.entries()) {
		const next = rounds[index + 1];
		for (const pool of column.pools) {
			const from = [column.x + columnWidth, anchor(pool)] as const;
			const link = (
				target: string,
				y: number | undefined,
				x: number | undefined,
			) => {
				if (y === undefined || x === undefined) return;
				flows.push({
					id: `${pool.id}>${target}`,
					d: curve(from[0], from[1], x, y),
				});
			};
			const nextPool = (wins: number, losses: number) =>
				next?.pools.find((p) => p.wins === wins && p.losses === losses);
			if (pool.wins + 1 >= swiss.wins)
				link("qualified", end.qualified.y + POOL_HEAD / 2, end.x);
			else {
				const target = nextPool(pool.wins + 1, pool.losses);
				link(target?.id ?? "", target && anchor(target), next?.x);
			}
			if (pool.losses + 1 >= swiss.losses)
				link("eliminated", end.eliminated.y + POOL_HEAD / 2, end.x);
			else {
				const target = nextPool(pool.wins, pool.losses + 1);
				link(target?.id ?? "", target && anchor(target), next?.x);
			}
		}
	}
	return {
		rounds,
		end,
		flows,
		width: endX + columnWidth,
		height: top + body,
		top,
	};
}
