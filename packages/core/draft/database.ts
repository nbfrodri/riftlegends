import type { ContentDatabase, ContentSet } from "@rift-legends/contracts";
import { QueryRejection } from "../server/dispatcher";
import { championPool, namedContent } from "./options";
import type { SeriesState } from "./series";

/**
 * The `content.database` query (#443): every team and every player of the
 * named content set (subs included), or of the session's current content.
 */
export const viewDatabase = (
	state: SeriesState,
	params: { content?: ContentSet } = {},
): ContentDatabase | QueryRejection => {
	const set = namedContent(state, params);
	if (set instanceof QueryRejection) return set;
	const rated = new Map(set.match?.players.map((p) => [p.id, p]));
	return {
		teams: (set.match?.teams ?? []).map(
			({ id, name, short, league, seed, coach }) => ({
				id,
				name,
				...(short && { short }),
				...(league && { league }),
				seed,
				coach,
			}),
		),
		players: (set.content?.players ?? []).flatMap(
			({
				id,
				team,
				role,
				handle,
				nationality,
				birthDate,
				estimated,
				level,
				sub,
				...picks
			}) => {
				const match = rated.get(id);
				return match
					? [
							{
								id,
								team,
								role,
								handle,
								...(nationality && { nationality }),
								...(birthDate && { birthDate }),
								level,
								sub: sub ?? false,
								attributes: match.attributes,
								...(estimated && { estimated }),
								pool: championPool(picks, match.mastery),
							},
						]
					: [];
			},
		),
	};
};
