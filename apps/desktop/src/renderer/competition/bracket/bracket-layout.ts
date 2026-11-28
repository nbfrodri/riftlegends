import type { BracketView } from "@rift-legends/contracts";

// Where each series of a bracket sits, in pixels, and the lines that join a
// series to the one its winner goes to. Pure, so the keyboard can move by
// position and the connectors share the coordinates of the cards.

type Match = BracketView["matches"][number];

export const CARD_W = 168;
export const CARD_H = 56;
const COL_GAP = 32;
const ROW_GAP = 14;
export const HEADER_H = 28;
const SECTION_GAP = 28;
const PITCH = CARD_W + COL_GAP;

export interface Placed {
	match: Match;
	x: number;
	y: number;
}

interface Connector {
	id: string;
	from: string;
	d: string;
	done: boolean;
}

interface Header {
	/** The first series of the column, which names its round. */
	match: Match;
	x: number;
	y: number;
}

export interface Layout {
	placed: Placed[];
	connectors: Connector[];
	headers: Header[];
	champion: { x: number; y: number } | null;
	width: number;
	height: number;
}

/** The reset final only shows once it is certain to be played. */
const isVisible = (match: Match) =>
	match.side !== "reset" || match.status === "ready" || match.status === "done";

const center = (placed: Placed) => placed.y + CARD_H / 2;
/** Top of a card stacked under `placed`, leaving room for its header. */
const below = (placed: Placed) => placed.y + CARD_H + ROW_GAP + HEADER_H;

/** Places one side by rounds: a series sits level with the series that feed it. */
function placeSide(
	matches: readonly Match[],
	top: number,
	rowGap: number,
	at: Map<string, Placed>,
	headers: Header[],
): number {
	const rounds = [...new Set(matches.map((m) => m.round))].sort(
		(a, b) => a - b,
	);
	let bottom = top;
	for (const [col, round] of rounds.entries()) {
		const column = matches.filter((m) => m.round === round);
		const x = col * PITCH;
		headers.push({ match: column[0] as Match, x, y: top });
		let previous = top + HEADER_H - CARD_H - rowGap;
		for (const match of column) {
			const feeders = match.from.flatMap((slot) => {
				const placed = slot.kind === "winner" ? at.get(slot.match) : undefined;
				return placed && placed.match.side === match.side
					? [center(placed)]
					: [];
			});
			const level = feeders.length
				? feeders.reduce((a, b) => a + b, 0) / feeders.length - CARD_H / 2
				: -Infinity;
			const y = Math.max(level, previous + CARD_H + rowGap);
			at.set(match.id, { match, x, y });
			previous = y;
			bottom = Math.max(bottom, y + CARD_H);
		}
	}
	return bottom;
}

const columns = (matches: readonly Match[], side: Match["side"]) =>
	new Set(matches.filter((m) => m.side === side).map((m) => m.round)).size;

export function layoutBracket(bracket: BracketView): Layout {
	const matches = bracket.matches.filter(isVisible);
	const at = new Map<string, Placed>();
	const headers: Header[] = [];
	const upper = matches.filter((m) => m.side === "upper");
	const lower = matches.filter((m) => m.side === "lower");
	// The draw summary shares the vertical budget of the bracket.
	const rowGap = bracket.draw ? 8 : ROW_GAP;
	const sectionGap = bracket.draw ? 20 : SECTION_GAP;
	let height = placeSide(upper, 0, rowGap, at, headers);
	if (lower.length)
		height = placeSide(lower, height + sectionGap, rowGap, at, headers);
	// The grand final gets its own column; its reset and the champion stack under it.
	const col = Math.max(columns(matches, "upper"), columns(matches, "lower"));
	let decider: Placed | undefined = [...at.values()]
		.filter(({ match }) => match.side === "upper")
		.at(-1);
	for (const match of matches.filter(
		(m) => m.side === "final" || m.side === "reset",
	)) {
		const feeders = match.from.flatMap((slot) => {
			const placed = slot.kind === "winner" ? at.get(slot.match) : undefined;
			return placed ? [center(placed)] : [];
		});
		const y =
			match.side === "reset" && decider
				? below(decider)
				: feeders.reduce((a, b) => a + b, 0) / Math.max(1, feeders.length) -
					CARD_H / 2;
		decider = { match, x: col * PITCH, y };
		at.set(match.id, decider);
		headers.push({ match, x: decider.x, y: y - HEADER_H });
	}
	const placed = matches.flatMap((m) => at.get(m.id) ?? []);
	const connectors = placed.flatMap((target) => {
		// The reset is fed by the grand final, not by the two brackets again.
		const sources =
			target.match.side === "reset"
				? ["GF"]
				: target.match.from.flatMap((slot) =>
						slot.kind === "winner" ? [slot.match] : [],
					);
		return sources.flatMap((id) => {
			const source = at.get(id);
			if (!source) return [];
			const [x1, y1] = [source.x + CARD_W, center(source)];
			const [x2, y2] = [target.x, center(target)];
			// Under its source (the reset): a hook on the right side.
			const d =
				x1 > x2
					? `M${x1} ${y1}H${x1 + COL_GAP / 2}V${y2}H${x1}`
					: `M${x1} ${y1}H${x2 - COL_GAP / 2}V${y2}H${x2}`;
			return [
				{
					id: `${id}>${target.match.id}`,
					from: id,
					d,
					done: source.match.status === "done",
				},
			];
		});
	});
	// The champion box (header and card) sits under the series that decided it.
	const champion =
		bracket.champion && decider ? { x: decider.x, y: below(decider) } : null;
	const columnsUsed = Math.max(0, ...placed.map((p) => p.x / PITCH + 1));
	return {
		placed,
		connectors,
		headers,
		champion,
		// Room on the right for the hook that joins the grand final to its reset.
		width: columnsUsed * PITCH - COL_GAP / 2,
		height: Math.max(
			height,
			...placed.map((p) => p.y + CARD_H),
			champion ? champion.y + CARD_H : 0,
		),
	};
}

type Direction = "up" | "down" | "left" | "right";

/** The series an arrow key moves to from `id`: same column for up and down, nearest column otherwise. */
export function neighbour(
	placed: readonly Placed[],
	id: string,
	direction: Direction,
) {
	const from = placed.find((p) => p.match.id === id);
	if (!from) return undefined;
	const vertical = direction === "up" || direction === "down";
	const sign = direction === "up" || direction === "left" ? -1 : 1;
	const candidates = placed.filter((p) =>
		vertical
			? p.x === from.x && Math.sign(p.y - from.y) === sign
			: Math.sign(p.x - from.x) === sign,
	);
	let best: Placed | undefined;
	let bestScore = Infinity;
	for (const p of candidates) {
		const score = vertical
			? Math.abs(p.y - from.y)
			: Math.abs(p.x - from.x) * 1e6 + Math.abs(p.y - from.y);
		if (score < bestScore) {
			best = p;
			bestScore = score;
		}
	}
	return best?.match.id;
}
