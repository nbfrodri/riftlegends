import { createContext, type ReactNode, use } from "react";
import type { CoreRequestError } from "../core";
import { type SeasonHandle, useExhibitionSeason } from "./season";

// The season the competition screens read: the exhibition season of
// «Competición» by default, or the tournament of «Torneo» (plan 31, U10), which
// shows the same hub, standings, schedule and series.

export interface SeasonScope {
	readonly season: SeasonHandle;
	/** The route that opens a played series of this season. */
	readonly seriesRoute: "/competicion/serie/$series" | "/torneo/serie/$series";
}

const ScopeContext = createContext<SeasonScope | null>(null);

/** Makes the screens below read `scope.season` instead of the exhibition season. */
export function SeasonScopeProvider(props: {
	scope: SeasonScope;
	children: ReactNode;
}) {
	return <ScopeContext value={props.scope}>{props.children}</ScopeContext>;
}

export interface ActiveSeason {
	readonly data: SeasonHandle | undefined;
	readonly error: CoreRequestError | null;
	readonly seriesRoute: SeasonScope["seriesRoute"];
}

/** The season in scope; the exhibition season, created on first use, without one. */
export function useActiveSeason(): ActiveSeason {
	const scope = use(ScopeContext);
	const exhibition = useExhibitionSeason(scope === null);
	return scope
		? { data: scope.season, error: null, seriesRoute: scope.seriesRoute }
		: {
				data: exhibition.data,
				error: exhibition.error,
				seriesRoute: "/competicion/serie/$series",
			};
}
