import { type BracketView, CONTRACT_VERSION } from "@rift-legends/contracts";
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
import { competitionName } from "./names";
import { ScheduleDays, type ScheduleSlot } from "./schedule-days";
import { type SeasonOverview, useTeamNames } from "./season";

// The «Schedule» view of a competition hub (plan 31, U4): its series by day,
// filtered by competition and team. Filters live in the route, so coming back
// from a series finds them as they were (U5).

const ALL = "all";

export interface ScheduleFilters {
	/** A competition id, or `ALL`. */
	readonly scope: string;
	readonly team?: string | undefined;
	/** The day to bring into view, left there when a series was opened. */
	readonly day?: number | undefined;
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
	const teamName = useTeamNames(sessionId);
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
				.map((id) => ({ value: id, label: teamName(id) }))
				.sort((a, b) => a.label.localeCompare(b.label)),
		[slots, teamName],
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

	return (
		<section
			aria-label={t("competition.schedule.label")}
			className="flex min-h-0 flex-1 flex-col gap-3"
		>
			<div className="flex flex-wrap items-center gap-3">
				<Select
					items={competitions}
					value={filters.scope}
					onValueChange={(scope) =>
						onFilters({ scope: scope as string, team: undefined })
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
					onChange={(team) =>
						onFilters({
							scope: filters.scope,
							team: team === ALL ? undefined : team,
						})
					}
					className="w-56"
				/>
			</div>
			{schedule.error ? (
				<CoreErrorMessage error={schedule.error} />
			) : (
				schedule.data && (
					<ScheduleDays
						slots={shown}
						year={overview.year}
						today={overview.day}
						focusDay={filters.day}
						showCompetition={filters.scope === ALL}
						team={teamName}
						competition={(id) => competitionName(t, id)}
						origin={origin}
						onOpen={onOpen}
					/>
				)
			)}
		</section>
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
	return (slot: ScheduleSlot, index: 0 | 1) => {
		const source = sources.find(
			(s) => s.competition === slot.competition && s.stage === slot.stage,
		);
		const match = source?.matches.get(localId(slot.id));
		const from = match?.from[index];
		return source && from ? originText(t, source.labels, from, false) : "";
	};
}

/** The schedule id names the series inside its stage last: `[competition, stage, series]`. */
function localId(id: string) {
	try {
		const parsed: unknown = JSON.parse(id);
		return Array.isArray(parsed) ? String(parsed.at(-1)) : id;
	} catch {
		return id;
	}
}
