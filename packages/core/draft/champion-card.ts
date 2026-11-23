import type {
	AiContent,
	ChampionCardView,
	ChampionRelation,
	ContentSet,
} from "@rift-legends/contracts";
import { abs } from "../math/int";
import type { SeriesState } from "./series";

type Opponent =
	| AiContent["matchups"][number]
	| NonNullable<AiContent["counters"]>[number];

/** Newer sets have mirrored rows. Older ones may only describe the other side. */
function opponents(rows: Opponent[], id: string): ChampionRelation[] {
	const found = new Map<string, ChampionRelation>();
	for (const row of rows) {
		const direct = row.champion === id;
		if ((!direct && row.against !== id) || !row.value) continue;
		const other = direct ? row.against : row.champion;
		const kind =
			"role" in row
				? { kind: "lane" as const, role: row.role }
				: { kind: "counter" as const };
		const key = JSON.stringify([other, "role" in row ? row.role : null]);
		if (direct || !found.has(key))
			found.set(key, {
				...kind,
				other,
				value: direct ? row.value : -row.value,
				reasons: row.reasons ?? [],
			});
	}
	return [...found.values()];
}

/** The board uses the session's content. The catalog can inspect a set before play. */
export function viewChampion(
	state: SeriesState,
	{ champion: id, content: set }: { champion: string; content?: ContentSet },
): ChampionCardView | null {
	const source = set ? state.library[set]?.() : state;
	if (!source) return null;
	const { content, match } = source;
	const champion = content?.champions.find((c) => c.id === id);
	const stats = match?.champions.find((c) => c.id === id);
	if (!content || !champion || !stats) return null;
	return {
		...champion,
		...stats,
		relations: [
			...opponents(content.matchups, id),
			...opponents(content.counters ?? [], id),
			...content.synergies.flatMap(({ a, b, value, reasons }) =>
				(a === id || b === id) && value > 0
					? [
							{
								kind: "synergy" as const,
								other: a === id ? b : a,
								value,
								reasons: reasons ?? [],
							},
						]
					: [],
			),
		].sort((a, b) => abs(b.value) - abs(a.value)),
		identities: content.identities.flatMap(({ id: plan, archetypes }) => {
			const shared = archetypes.filter((a) => champion.archetypes.includes(a));
			return shared.length ? [{ id: plan, archetypes: shared }] : [];
		}),
	};
}
