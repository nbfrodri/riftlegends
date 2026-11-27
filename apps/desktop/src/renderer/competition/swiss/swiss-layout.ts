import type { StandingsView } from "@rift-legends/contracts";

// Where every piece of the Swiss view goes (#487), as the Worlds broadcast
// draws it: one column per round with its pools stacked by balance and
// centred, so winners climb and losers sink; the teams a round qualifies sit
// on top of the next column and the ones it eliminates at its bottom. Pure,
// so the view only draws it.

type Swiss = NonNullable<StandingsView["swiss"]>;
export type SwissSeries = Swiss["rounds"][number]["series"][number];
type Outcome = "qualified" | "eliminated";
type Result = "win" | "loss";

export const CARD_H = 38;
const CARD_GAP = 8;
/** Inner padding of a block around its cards and rows. */
export const BLOCK_PAD = 6;
/** The block header, inside the block: its balance (and outcome). */
export const POOL_HEAD = 20;
const POOL_GAP = 10;
export const ROUND_HEAD = 24;
export const NOTE_H = 30;
export const ROW_H = 20;
const ROW_GAP = 2;
const BOX_GAP = 8;
export const COL_GAP = 32;

interface PlacedPool {
	/** `round:wins-losses`, as the flow lines name it. */
	id: string;
	wins: number;
	losses: number;
	/** `null`: a round not paired yet, with a placeholder. */
	series: readonly SwissSeries[] | null;
	y: number;
	height: number;
}

export interface PlacedBox {
	/** `column:qualified` or `column:eliminated`. */
	id: string;
	outcome: Outcome;
	wins: number;
	losses: number;
	teams: string[];
	y: number;
	height: number;
}

interface PlacedColumn {
	/** The round it shows; the last column only has the final outcomes. */
	round: number | null;
	relaxed: Swiss["rounds"][number]["relaxed"];
	x: number;
	pools: PlacedPool[];
	boxes: PlacedBox[];
}

const stack = (count: number, size: number, gap: number) =>
	POOL_HEAD + count * size + (count - 1) * gap + BLOCK_PAD;
const poolHeight = (cards: number) => stack(cards, CARD_H, CARD_GAP);
const boxHeight = (rows: number) => stack(Math.max(1, rows), ROW_H, ROW_GAP);
export const cardTop = (index: number) =>
	POOL_HEAD + index * (CARD_H + CARD_GAP);
export const rowTop = (index: number) => POOL_HEAD + index * (ROW_H + ROW_GAP);

/** Balances a round can have before it is paired: 0-0, then 1-0 and 0-1… */
function expectedPools(swiss: Swiss, round: number) {
	const pools: [number, number][] = [];
	for (let wins = round - 1; wins >= 0; wins--) {
		const losses = round - 1 - wins;
		if (wins < swiss.wins && losses < swiss.losses) pools.push([wins, losses]);
	}
	return pools;
}

function roundPools(swiss: Swiss, round: number) {
	const paired = swiss.rounds.find((r) => r.round === round);
	if (!paired)
		return expectedPools(swiss, round).map(([wins, losses]) => ({
			wins,
			losses,
			series: null as readonly SwissSeries[] | null,
		}));
	const byRecord = new Map<string, SwissSeries[]>();
	for (const series of paired.series) {
		const key = series.record.join("-");
		byRecord.set(key, [...(byRecord.get(key) ?? []), series]);
	}
	return [...byRecord.values()]
		.map((series) => {
			const [wins, losses] = series[0]?.record ?? [0, 0];
			return { wins, losses, series: series as readonly SwissSeries[] | null };
		})
		.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

/** The outcome boxes of a column: who ended with `played` series that way. */
function columnBoxes(swiss: Swiss, played: number) {
	const boxes: Omit<PlacedBox, "id" | "y" | "height">[] = [];
	const add = (outcome: Outcome, wins: number, losses: number) => {
		if (wins < 0 || losses < 0) return;
		boxes.push({
			outcome,
			wins,
			losses,
			teams: swiss.teams
				.filter(
					(row) =>
						row.status === outcome &&
						row.wins === wins &&
						row.losses === losses,
				)
				.map(({ team }) => team),
		});
	};
	if (played - swiss.wins < swiss.losses)
		add("qualified", swiss.wins, played - swiss.wins);
	if (played - swiss.losses < swiss.wins)
		add("eliminated", played - swiss.losses, swiss.losses);
	return boxes;
}

export function layoutSwiss(swiss: Swiss, columnWidth: number) {
	const total = Math.max(
		swiss.totalRounds,
		...swiss.rounds.map(({ round }) => round),
	);
	const notes = swiss.rounds.some(({ relaxed }) => relaxed.length > 0);
	const top = ROUND_HEAD + (notes ? NOTE_H : 0);
	const raw = Array.from({ length: total + 1 }, (_, index) => {
		const round = index < total ? index + 1 : null;
		return {
			round,
			relaxed: swiss.rounds.find((r) => r.round === round)?.relaxed ?? [],
			pools: round ? roundPools(swiss, round) : [],
			boxes: columnBoxes(swiss, index),
		};
	});
	const poolsHeight = (pools: (typeof raw)[number]["pools"]) =>
		pools.reduce(
			(sum, pool, i) =>
				sum + poolHeight(pool.series?.length ?? 1) + (i ? POOL_GAP : 0),
			0,
		);
	const boxOf = (column: (typeof raw)[number], outcome: Outcome) =>
		column.boxes.find((box) => box.outcome === outcome);
	const edge = (column: (typeof raw)[number], outcome: Outcome) => {
		const box = boxOf(column, outcome);
		return box ? boxHeight(box.teams.length) + BOX_GAP : 0;
	};
	// Pools sit in the middle; boxes take the same room above and below.
	const half = (column: (typeof raw)[number]) =>
		poolsHeight(column.pools) / 2 +
		Math.max(edge(column, "qualified"), edge(column, "eliminated"));
	const body = 2 * Math.max(...raw.map(half));
	const middle = top + body / 2;
	const columns: PlacedColumn[] = raw.map((column, index) => {
		let y = middle - poolsHeight(column.pools) / 2;
		const pools = column.pools.map((pool) => {
			const height = poolHeight(pool.series?.length ?? 1);
			const placed = {
				...pool,
				id: `${column.round}:${pool.wins}-${pool.losses}`,
				y,
				height,
			};
			y += height + POOL_GAP;
			return placed;
		});
		const boxes = column.boxes.map((box) => {
			const height = boxHeight(box.teams.length);
			return {
				...box,
				id: `${index + 1}:${box.outcome}`,
				height,
				y: box.outcome === "qualified" ? top : top + body - height,
			};
		});
		return {
			round: column.round,
			relaxed: column.relaxed,
			x: index * (columnWidth + COL_GAP),
			pools,
			boxes,
		};
	});
	// Elbow lines from block to block, as in the bracket: out of the block's
	// right edge, along the middle of the gap, into the target block's header.
	const elbow = (x1: number, y1: number, x2: number, y2: number) =>
		`M${x1} ${y1} H${(x1 + x2) / 2} V${y2} H${x2}`;
	/** Lines enter a block at one fixed point: the middle of its header. */
	const entry = ({ y }: { y: number }) => y + POOL_HEAD / 2;
	/** Winners leave from the upper part of the block, losers from the lower. */
	const exit = (pool: PlacedPool, result: Result) =>
		pool.y + (pool.height * (result === "win" ? 1 : 3)) / 4;
	const flows: { id: string; d: string; result: Result }[] = [];
	for (const [index, column] of columns.entries()) {
		const next = columns[index + 1];
		if (!next) continue;
		for (const pool of column.pools) {
			const targets = [
				[
					"win",
					pool.wins + 1 >= swiss.wins
						? next.boxes.find((box) => box.outcome === "qualified")
						: next.pools.find(
								(p) => p.wins === pool.wins + 1 && p.losses === pool.losses,
							),
				],
				[
					"loss",
					pool.losses + 1 >= swiss.losses
						? next.boxes.find((box) => box.outcome === "eliminated")
						: next.pools.find(
								(p) => p.wins === pool.wins && p.losses === pool.losses + 1,
							),
				],
			] as const;
			for (const [result, target] of targets)
				if (target)
					flows.push({
						id: `${pool.id}>${target.id}`,
						result,
						d: elbow(
							column.x + columnWidth,
							exit(pool, result),
							next.x,
							entry(target),
						),
					});
		}
	}
	return {
		columns,
		flows,
		width: total * (columnWidth + COL_GAP) + columnWidth,
		height: top + body,
	};
}
