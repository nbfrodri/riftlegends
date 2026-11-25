import type { ContentSet, SeriesOptions } from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { QueryRejection } from "../server/dispatcher";
import type { LoadedContent, SeriesState } from "./series";

const KINDS = [
	["main", "mains"],
	["secondary", "secondary"],
	["weak", "weak"],
] as const;

/** Mains, secondary and weak champions that have a mastery rating. */
export function championPool(
	picks: Record<"mains" | "secondary" | "weak", readonly string[]>,
	mastery: readonly { champion: string; value: number }[] = [],
) {
	return KINDS.flatMap(([kind, key]) =>
		picks[key].flatMap((champion) => {
			const row = mastery.find((m) => m.champion === champion);
			return row ? [{ champion, kind, mastery: row.value }] : [];
		}),
	);
}

/** Each team's starters, in content order, with their attributes. */
function lineups({ content, match }: Partial<LoadedContent>) {
	const masteries = new Map(match?.players.map((p) => [p.id, p.mastery]));
	const rosters = content ? indexContent(content).rosters : null;
	const attributes = new Map(match?.players.map((p) => [p.id, p.attributes]));
	return (team: string) =>
		(content?.players ?? []).flatMap(
			({
				id,
				team: of,
				role,
				handle,
				nationality,
				birthDate,
				estimated,
				...picks
			}) => {
				const rated = attributes.get(id);
				return of === team && rated && rosters?.get(team)?.get(role)?.id === id
					? [
							{
								id,
								role,
								handle,
								...(nationality && { nationality }),
								...(birthDate && { birthDate }),
								attributes: rated,
								...(estimated && { estimated }),
								pool: championPool(picks, masteries.get(id)),
							},
						]
					: [];
			},
		);
}

/** The content set `params` names, or the session's current content. */
export function namedContent(
	state: SeriesState,
	params: { content?: ContentSet },
): Partial<LoadedContent> | QueryRejection {
	if (!params.content)
		return {
			...(state.content && { content: state.content }),
			...(state.match && { match: state.match }),
		};
	return (
		state.library[params.content]?.() ??
		new QueryRejection({ code: "invalid-command", params: { path: "content" } })
	);
}

/**
 * The `series.options` query: the teams (with their starters' attributes) and
 * the champion pool (with each champion's roles and tiers) of the named content
 * set, or of the session's current content. Empty in a session without content.
 */
export const viewOptions = (
	state: SeriesState,
	params: { content?: ContentSet } = {},
): SeriesOptions | QueryRejection => {
	const set = namedContent(state, params);
	if (set instanceof QueryRejection) return set;
	const champions = set.content?.champions ?? [];
	const players = lineups(set);
	return {
		...(set.season !== undefined && { season: set.season }),
		teams: (set.match?.teams ?? []).map(
			({ id, name, seed, coach, league }) => ({
				id,
				name,
				seed,
				coach,
				...(league && { league }),
				players: players(id),
			}),
		),
		pool: champions.map((champion) => champion.id),
		champions: champions.map(({ id, name, positions }) => ({
			id,
			name,
			roles: positions.map((position) => position.role),
		})),
		positions: Object.fromEntries(
			champions.map((champion) => [champion.id, champion.positions]),
		),
	};
};
