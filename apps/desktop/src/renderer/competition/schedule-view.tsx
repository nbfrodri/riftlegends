import {
	type BracketView,
	CONTRACT_VERSION,
	type ScheduleView as ScheduleList,
} from "@rift-legends/contracts";
import { SearchSelect } from "@rift-legends/ui-kit/components/search-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	CoreErrorMessage,
	useCoreQueries,
	useCoreQuery,
	useFacts,
} from "../core";
import { bracketLabels, originText } from "./bracket/bracket-labels";
import { Calendar, type CalendarMode } from "./calendar/calendar";
import { competitionName } from "./names";
import { type SeasonOverview, useTeams } from "./season";

// The season calendar with its filters (plan 31, U4; #593): the «Schedule» tab
// of a competition hub and the sidebar «Calendar». Filters, view and day live in
// the route, so coming back from a series finds them as they were (U5).

/** One series of `competition.schedule`. */
export type ScheduleSlot = ScheduleList[number];

export const ALL = "all";

export interface ScheduleFilters {
	/** A competition id, or `ALL`. */
	readonly scope: string;
	readonly team?: string | undefined;
	readonly mode: CalendarMode;
	/** The chosen day; without one the calendar follows today. */
	readonly day?: number | undefined;
}

/** Where the calendar is, in a route's search. */
export interface CalendarSearch {
	/** Schedule filters: a competition id or `all`, and a team. */
	readonly scope?: string | undefined;
	readonly team?: string | undefined;
	/** The calendar view; week when missing. */
	readonly calendar?: CalendarMode | undefined;
	/** The chosen day; without one the calendar follows today. */
	readonly day?: number | undefined;
}

const text = (value: unknown) =>
	typeof value === "string" && value.length > 0 ? value : undefined;
const modes = new Set<unknown>(["day", "week", "month"]);

/** The calendar's part of a route's search, from whatever the route receives. */
export function parseCalendarSearch(
	search: Record<string, unknown>,
): CalendarSearch {
	return {
		scope: text(search.scope),
		team: text(search.team),
		calendar: modes.has(search.calendar)
			? (search.calendar as CalendarMode)
			: undefined,
		day: Number.isSafeInteger(search.day) ? (search.day as number) : undefined,
	};
}

const seasonFact = (fact: { type: string }) =>
	fact.type.startsWith("competition.") || fact.type.startsWith("season.");

export function ScheduleView({
	sessionId,
	overview,
	filters,
	onFilters,
	onOpen,
}: {
	sessionId: number;
	overview: SeasonOverview;
	filters: ScheduleFilters;
	onFilters: (filters: ScheduleFilters) => void;
	onOpen: (slot: ScheduleSlot) => void;
}) {
	const { t } = useTranslation();
	const team = useTeams(sessionId);
	const scoped = filters.scope === ALL ? undefined : filters.scope;
	const schedule = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: scoped ? { competition: scoped } : {},
		},
		{ affectedBy: seasonFact },
	);
	const slots = schedule.data ?? [];
	const origin = useOrigins(sessionId, slots);

	const teams = useMemo(
		() =>
			[
				...new Set(
					slots.flatMap(({ teams }) => teams.filter((id) => id !== null)),
				),
			]
				.map((id) => ({ value: id, label: team(id).name }))
				.sort((a, b) => a.label.localeCompare(b.label)),
		[slots, team],
	);
	const shown = filters.team
		? slots.filter(({ teams }) => teams.includes(filters.team as string))
		: slots;

	const competitions = [
		{ value: ALL, label: t("competition.schedule.allCompetitions") },
		...overview.competitions.map(({ id }) => ({
			value: id,
			label: competitionName(t, id),
		})),
	];

	if (schedule.error) return <CoreErrorMessage error={schedule.error} />;
	if (!schedule.data) return null;
	return (
		<Calendar
			slots={shown}
			year={overview.year}
			today={overview.day}
			place={filters}
			onPlace={({ mode, day }) => onFilters({ ...filters, mode, day })}
			showCompetition={filters.scope === ALL}
			team={team}
			competition={(id) => competitionName(t, id)}
			origin={origin}
			onOpen={onOpen}
		>
			<Select
				items={competitions}
				value={filters.scope}
				onValueChange={(scope) =>
					onFilters({ ...filters, scope: scope as string, team: undefined })
				}
			>
				<SelectTrigger
					aria-label={t("competition.schedule.competition")}
					className="w-52"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{competitions.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<SearchSelect
				label={t("competition.schedule.team")}
				searchLabel={t("competition.schedule.teamSearch")}
				empty={t("competition.schedule.teamEmpty")}
				groups={[
					{
						items: [
							{ value: ALL, label: t("competition.schedule.allTeams") },
							...teams,
						],
					},
				]}
				value={filters.team ?? ALL}
				onChange={(next) =>
					onFilters({ ...filters, team: next === ALL ? undefined : next })
				}
				className="w-56"
			/>
		</Calendar>
	);
}

/**
 * Where the pending teams of a bracket come from («Winner of Semifinal 1»),
 * read from `competition.bracket` of each stage with a pending series. Before a
 * stage starts it has no bracket yet, and the team is only «to be decided».
 */
function useOrigins(sessionId: number, slots: readonly ScheduleSlot[]) {
	const { t } = useTranslation();
	const client = useQueryClient();
	useFacts((facts) => {
		if (facts.some(seasonFact))
			void client.invalidateQueries({
				queryKey: ["core", sessionId, "competition.bracket"],
			});
	});
	const stages = useMemo(
		() => [
			...new Map(
				slots
					.filter(({ teams }) => teams.includes(null))
					.map(({ competition, stage }) => [
						`${competition}/${stage}`,
						{ competition, stage },
					]),
			).values(),
		],
		[slots],
	);
	const brackets = useCoreQueries<BracketView | null>(
		stages.map((params) => ({
			v: CONTRACT_VERSION,
			kind: "competition.bracket",
			sessionId,
			params,
		})),
	);
	const sources = stages.map((stage, index) => {
		const bracket = brackets[index]?.data;
		return {
			...stage,
			matches: new Map(bracket?.matches.map((match) => [match.id, match])),
			labels: bracketLabels(bracket?.matches ?? []),
		};
	});
	return (slot: ScheduleSlot, index: 0 | 1, short: boolean) => {
		const source = sources.find(
			(s) => s.competition === slot.competition && s.stage === slot.stage,
		);
		const match = slot.match ? source?.matches.get(slot.match) : undefined;
		const from = match?.from[index];
		return source && from ? originText(t, source.labels, from, short) : "";
	};
}
