import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { Fearless } from "../draft/availability";
import { DRAFT_ORDER, type DraftAction, type Order } from "../draft/order";
import { max } from "../math";
import { deriveSeed } from "../rng/seeds";

type Game = RealSnapshot["games"][number];

/** What the bank reads of a snapshot game (Leaguepedia, CC BY-SA). */
export type BankGame = Pick<
	Game,
	"id" | "tournament" | "teams" | "winner" | "draftOrder"
>;

/**
 * A pro draft in the 20 steps of `DRAFT_ORDER`. Blue side picks first, as in
 * every league of the snapshot. `null` is an empty ban.
 */
export interface ProDraft {
	readonly id: string;
	readonly league: string;
	readonly tournament: string;
	readonly series: string;
	readonly game: number;
	readonly blue: string;
	readonly red: string;
	readonly winner: string | undefined;
	readonly actions: readonly (string | null)[];
	/** Picks of the earlier games of the series, by team. */
	readonly previous: readonly Readonly<Record<string, readonly string[]>>[];
	readonly fearless: Fearless;
	/** Wins of each team in the series before this game. */
	readonly wins: Readonly<Record<string, number>>;
	readonly winsNeeded: number;
}

const GAME_ID = /^(.*)_(\d+)$/;
/** Series needed before a tournament without repeated picks counts as fearless. */
const MIN_SERIES_FOR_FEARLESS = 5;
/** Share of series (in percent) kept apart as validation. */
const VALIDATION_PERCENT = 30;

const picksOf = (game: BankGame) =>
	Object.fromEntries(game.teams.map((t) => [t.id, t.picks])) as Record<
		string,
		(string | null)[]
	>;

/** Ordered bans and picks of both teams, interleaved as the real draft ran. */
function interleave(blue: Game["teams"][number], red: Game["teams"][number]) {
	const used = new Map<string, number>();
	return DRAFT_ORDER.map(({ order, action }) => {
		const team = order === ("first" as Order) ? blue : red;
		const slot = `${team.id}:${action}`;
		const index = used.get(slot) ?? 0;
		used.set(slot, index + 1);
		const list: readonly (string | null)[] =
			action === ("pick" as DraftAction) ? team.picks : team.bans;
		return list[index] ?? null;
	});
}

const isComplete = (game: BankGame) =>
	game.draftOrder &&
	game.teams.length === 2 &&
	game.teams.every((t) => t.picks.length === 5 && !t.picks.includes(null)) &&
	game.teams.every((t) => t.bans.length === 5);

/** Every complete ordered draft of a league's games, in game id order. */
export function proDrafts(
	league: string,
	games: readonly BankGame[],
): ProDraft[] {
	const sorted = games
		.filter(isComplete)
		.map((game) => {
			const [, series = game.id, number = "1"] = GAME_ID.exec(game.id) ?? [];
			return { game, series, number: Number(number) };
		})
		.sort((a, b) => (a.game.id < b.game.id ? -1 : 1));
	const bySeries = new Map<string, typeof sorted>();
	for (const entry of sorted) {
		bySeries.set(entry.series, [...(bySeries.get(entry.series) ?? []), entry]);
	}
	const longest = new Map<string, number>();
	for (const [, entries] of bySeries) {
		const tournament = (entries[0] as (typeof sorted)[number]).game.tournament;
		longest.set(
			tournament,
			entries.reduce((m, e) => max(m, e.number), longest.get(tournament) ?? 1),
		);
	}
	const drafts: ProDraft[] = [];
	for (const entries of bySeries.values()) {
		entries.sort((a, b) => a.number - b.number);
		const previous: Record<string, readonly string[]>[] = [];
		const wins: Record<string, number> = {};
		for (const { game, series, number } of entries) {
			const blue = game.teams.find((t) => t.side === "blue");
			const red = game.teams.find((t) => t.side === "red");
			if (!blue || !red) continue;
			const longestOf = longest.get(game.tournament) ?? 1;
			drafts.push({
				id: game.id,
				league,
				tournament: game.tournament,
				series,
				game: number,
				blue: blue.id,
				red: red.id,
				winner: game.winner,
				actions: interleave(blue, red),
				previous: [...previous],
				fearless: "off",
				wins: { ...wins },
				winsNeeded: longestOf >= 4 ? 3 : longestOf >= 2 ? 2 : 1,
			});
			previous.push(picksOf(game) as Record<string, string[]>);
			if (game.winner) wins[game.winner] = (wins[game.winner] ?? 0) + 1;
		}
	}
	drafts.sort((a, b) => (a.id < b.id ? -1 : 1));
	const fearless = inferFearless(drafts);
	return drafts.map((d) => ({
		...d,
		fearless: fearless.get(d.tournament) ?? "off",
	}));
}

/**
 * The snapshot does not record the fearless rule, so a tournament is hard
 * fearless when none of its series ever repeats a pick.
 */
export function inferFearless(
	drafts: readonly ProDraft[],
): Map<string, Fearless> {
	const series = new Map<string, ProDraft[]>();
	for (const draft of drafts) {
		series.set(draft.series, [...(series.get(draft.series) ?? []), draft]);
	}
	const stats = new Map<string, { multi: number; repeats: number }>();
	for (const games of series.values()) {
		if (games.length < 2) continue;
		const tournament = (games[0] as ProDraft).tournament;
		const seen = new Set<string>();
		let repeated = false;
		for (const game of games) {
			const picks = DRAFT_ORDER.flatMap((step, i) =>
				step.action === "pick" ? [game.actions[i] as string] : [],
			);
			if (picks.some((c) => seen.has(c))) repeated = true;
			for (const c of picks) seen.add(c);
		}
		const entry = stats.get(tournament) ?? { multi: 0, repeats: 0 };
		entry.multi++;
		if (repeated) entry.repeats++;
		stats.set(tournament, entry);
	}
	const result = new Map<string, Fearless>();
	for (const draft of drafts) {
		const entry = stats.get(draft.tournament);
		result.set(
			draft.tournament,
			entry && entry.multi >= MIN_SERIES_FOR_FEARLESS && entry.repeats === 0
				? "hard"
				: "off",
		);
	}
	return result;
}

/** Hash split by series, so the games of one series never straddle it. */
export function splitOf(
	draft: Pick<ProDraft, "series">,
	seed: number,
): "train" | "validation" {
	const words = [...draft.series].map((c) => c.charCodeAt(0));
	return deriveSeed(seed, 0xca11, ...words) % 100 < VALIDATION_PERCENT
		? "validation"
		: "train";
}
