import type { ContentSet, SeriesOptions } from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { QueryRejection } from "../server/dispatcher";
import type { LoadedContent, SeriesState } from "./series";

/** Each team's starters, in content order, with their attributes. */
function lineups({ content, match }: Partial<LoadedContent>) {
	const rosters = content ? indexContent(content).rosters : null;
	const attributes = new Map(match?.players.map((p) => [p.id, p.attributes]));
	return (team: string) =>
		(content?.players ?? []).flatMap(
			({ id, team: of, role, handle, nationality, estimated }) => {
				const rated = attributes.get(id);
				return of === team && rated && rosters?.get(team)?.get(role)?.id === id
					? [
							{
								id,
								role,
								handle,
								...(nationality && { nationality }),
								attributes: rated,
								...(estimated && { estimated }),
							},
						]
					: [];
			},
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
	let set: Partial<LoadedContent> = {
		...(state.content && { content: state.content }),
		...(state.match && { match: state.match }),
	};
	if (params.content) {
		const named = state.library[params.content]?.();
		if (!named) {
			return new QueryRejection({
				code: "invalid-command",
				params: { path: "content" },
			});
		}
		set = named;
	}
	const champions = set.content?.champions ?? [];
	const players = lineups(set);
	return {
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
