import {
	CONTRACT_VERSION,
	type ContentDatabase,
	type competitionViews,
} from "@rift-legends/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
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

/**
 * Opens the session and creates the exhibition season, once per app run;
 * not while `enabled` is false (a screen that reads another season).
 */
export function useExhibitionSeason(enabled = true) {
	const core = useCore();
	const client = useQueryClient();
	const content = appContent();
	const season = useQuery<SeasonHandle, CoreRequestError>({
		queryKey: [...exhibitionKey, content],
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
		enabled,
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
	readonly stage: string;
	readonly day: number;
	readonly status: "played" | "ready" | "pending";
}

/** Match days of a stage: those already played and all of them. */
export interface Matchdays {
	readonly played: number;
	readonly total: number;
}

export interface SeasonSchedule {
	/** The next match day of each competition. */
	readonly nextDay: ReadonlyMap<string, number>;
	/** By `competition/stage`. */
	readonly matchdays: ReadonlyMap<string, Matchdays>;
}

export const stageKeyOf = (competition: string, stage: string) =>
	`${competition}/${stage}`;

/** The whole calendar, read again after each day, as match days per stage. */
export function useSeasonSchedule(sessionId: number): SeasonSchedule {
	const schedule = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: {},
		},
		{ affectedBy: seasonFact },
	);
	return useMemo(() => {
		const nextDay = new Map<string, number>();
		const days = new Map<string, Map<number, boolean>>();
		for (const slot of schedule.data ?? []) {
			if (slot.status !== "played" && !nextDay.has(slot.competition))
				nextDay.set(slot.competition, slot.day);
			const key = stageKeyOf(slot.competition, slot.stage);
			const stage = days.get(key) ?? new Map<number, boolean>();
			stage.set(
				slot.day,
				(stage.get(slot.day) ?? true) && slot.status === "played",
			);
			days.set(key, stage);
		}
		const matchdays = new Map(
			[...days].map(([key, stage]) => [
				key,
				{
					played: [...stage.values()].filter(Boolean).length,
					total: stage.size,
				},
			]),
		);
		return { nextDay, matchdays };
	}, [schedule.data]);
}

/** The content's teams by id: name and, when it has one, short name. */
export function useTeams(sessionId: number) {
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
		(id: string): { name: string; short?: string | undefined } => {
			const team = database.data?.teams.find((team) => team.id === id);
			return team ? { name: team.name, short: team.short } : { name: id };
		},
		[database.data],
	);
}

/** Display names of the content's teams, by id. */
export function useTeamNames(sessionId: number) {
	const team = useTeams(sessionId);
	return useCallback((id: string) => team(id).name, [team]);
}
