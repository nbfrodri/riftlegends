import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { CoreFact } from "../../shared/bridge";
import type { PendingSeries, PendingStore } from "../competition/advance";
import type { SeasonHandle } from "../competition/season";
import { CoreRequestError, useCore } from "../core";

// The tournament of «Torneo» lives for as long as the app runs (plan 31):
// leaving the screen keeps its session, its progress, the series waiting for
// the user and the one being played. The query cache holds it.

/** The user's series on screen: its id and the facts it has returned so far. */
export interface SeriesInPlay {
	readonly series: string;
	readonly facts: readonly CoreFact[];
}

export interface TournamentRun {
	readonly season: SeasonHandle;
	readonly humanTeam: string | null;
	readonly pending: PendingSeries | null;
	readonly playing: SeriesInPlay | null;
	/** After the final: the champion screen until the user opens the hub. */
	readonly hub: boolean;
}

const sessionKey = ["tournament", "session"] as const;
const runKey = (sessionId: number) => ["tournament", "run", sessionId] as const;
const forever = {
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: Number.POSITIVE_INFINITY,
};

/** The tournament's core session, opened once; `restart` opens a new one. */
export function useTournamentSession() {
	const core = useCore();
	const client = useQueryClient();
	const session = useQuery<number, CoreRequestError>({
		queryKey: sessionKey,
		...forever,
		queryFn: async () => {
			const opened = await core.open();
			if (!opened.ok) throw new CoreRequestError(opened.error);
			await client.resetQueries({ queryKey: ["core", opened.sessionId] });
			return opened.sessionId;
		},
	});
	const restart = useCallback(
		() => client.resetQueries({ queryKey: ["tournament"] }),
		[client],
	);
	return { ...session, restart };
}

/** The tournament created on `sessionId`, if any, and how to change it. */
export function useTournamentRun(sessionId: number) {
	const client = useQueryClient();
	const key = runKey(sessionId);
	const run = useQuery<TournamentRun>({
		queryKey: key,
		queryFn: skipToken,
		...forever,
	}).data;
	const update = useCallback(
		(change: (run: TournamentRun) => TournamentRun) =>
			client.setQueryData<TournamentRun>(runKey(sessionId), (current) =>
				current ? change(current) : current,
			),
		[client, sessionId],
	);
	const create = useCallback(
		(position: number, humanTeam: string | null) =>
			client.setQueryData<TournamentRun>(runKey(sessionId), {
				season: { sessionId, position: { current: position } },
				humanTeam,
				pending: null,
				playing: null,
				hub: false,
			}),
		[client, sessionId],
	);
	const pendingStore = useMemo<PendingStore>(
		() => ({
			pending: run?.pending ?? null,
			setPending: (pending) => update((run) => ({ ...run, pending })),
		}),
		[run?.pending, update],
	);
	return { run, update, create, pendingStore };
}
