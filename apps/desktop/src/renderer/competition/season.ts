import {
	CONTRACT_VERSION,
	type ContentDatabase,
	type competitionViews,
} from "@rift-legends/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CoreFact } from "../../shared/bridge";
import { appContent } from "../content-set";
import { CoreRequestError, useCore, useCoreQuery } from "../core";

// The exhibition season of plan 31 (decision 1): an AI-only season created on
// the first visit to «Competición». It lives in its own core session for as
// long as the app runs, so leaving the section keeps its progress.

export type SeasonOverview = ReturnType<typeof competitionViews.overview.parse>;
export type CompetitionOverview = SeasonOverview["competitions"][number];

export interface SeasonHandle {
	readonly sessionId: number;
	/** Position of the next fact; only the advance loop sends commands. */
	readonly position: { current: number };
}

const exhibitionKey = ["competition", "exhibition"] as const;

/** Opens the session and creates the exhibition season, once per app run. */
export function useExhibitionSeason() {
	const core = useCore();
	const client = useQueryClient();
	const content = appContent();
	const season = useQuery<SeasonHandle, CoreRequestError>({
		queryKey: [...exhibitionKey, content],
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			const opened = await core.open();
			if (!opened.ok) throw new CoreRequestError(opened.error);
			const { sessionId } = opened;
			await client.resetQueries({ queryKey: ["core", sessionId] });
			const body = await core.query({
				v: CONTRACT_VERSION,
				kind: "season.exhibition",
				sessionId,
				params: { content },
			});
			if (!body.ok) throw new CoreRequestError(body.error);
			const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
			const created = await core.send({
				v: CONTRACT_VERSION,
				kind: "season.create",
				sessionId,
				expectedPosition: 0,
				payload: { ...(body.view as object), seed },
			});
			if (!created.ok) throw new CoreRequestError(created.error);
			return { sessionId, position: { current: created.position } };
		},
	});
	/** Throws the season away and creates a new one. */
	const restart = useCallback(
		() => client.resetQueries({ queryKey: exhibitionKey }),
		[client],
	);
	return { ...season, restart };
}

const seasonFact = (fact: CoreFact) =>
	fact.type.startsWith("competition.") || fact.type.startsWith("season.");
const noFact = () => false;

export function useSeasonOverview(sessionId: number) {
	return useCoreQuery<SeasonOverview>(
		{ v: CONTRACT_VERSION, kind: "season.overview", sessionId, params: {} },
		{ affectedBy: seasonFact },
	);
}

interface ScheduleSlot {
	readonly competition: string;
	readonly day: number;
	readonly status: "played" | "ready" | "pending";
}

/** Days ahead read to find each competition's next match day. */
const LOOKAHEAD_DAYS = 60;

/** The next match day of each competition, within the next weeks. */
export function useNextDays(sessionId: number, day: number | null) {
	const schedule = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: { fromDay: day ?? 0, toDay: (day ?? 0) + LOOKAHEAD_DAYS },
		},
		{ affectedBy: seasonFact, enabled: day !== null },
	);
	const next = new Map<string, number>();
	for (const slot of schedule.data ?? [])
		if (slot.status !== "played" && !next.has(slot.competition))
			next.set(slot.competition, slot.day);
	return next;
}

/** Display names of the content's teams, by id. */
export function useTeamNames(sessionId: number) {
	const database = useCoreQuery<ContentDatabase>(
		{
			v: CONTRACT_VERSION,
			kind: "content.database",
			sessionId,
			params: { content: appContent() },
		},
		{ affectedBy: noFact },
	);
	return useCallback(
		(id: string) =>
			database.data?.teams.find((team) => team.id === id)?.name ?? id,
		[database.data],
	);
}
