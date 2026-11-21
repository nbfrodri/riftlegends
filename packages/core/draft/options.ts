import type { SeriesOptions } from "@rift-legends/contracts";
import type { SeriesState } from "./series";

/**
 * The `series.options` query: the teams (with their players' attributes) and
 * the champion pool (with each champion's roles and tiers) the session was opened with.
 * Empty in a session without content.
 */
export const viewOptions = (state: SeriesState): SeriesOptions => {
	const champions = state.content?.champions ?? [];
	const players = (team: string) =>
		(state.content?.players ?? []).flatMap(({ id, team: of, role }) => {
			const attributes = state.match?.players.find(
				(p) => p.id === id,
			)?.attributes;
			return of === team && attributes ? [{ id, role, attributes }] : [];
		});
	return {
		teams: (state.match?.teams ?? []).map(({ id, name, coach }) => ({
			id,
			name: name ?? id,
			...(coach ? { coach } : {}),
			players: players(id),
		})),
		pool: champions.map((champion) => champion.id),
		champions: champions.map(({ id, positions }) => ({
			id,
			roles: positions.map((position) => position.role),
		})),
		positions: Object.fromEntries(
			champions.map((champion) => [champion.id, champion.positions]),
		),
	};
};
