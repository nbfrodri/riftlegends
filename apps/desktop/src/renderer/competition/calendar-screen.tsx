import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CoreErrorMessage } from "../core";
import { ALL, type CalendarSearch, ScheduleView } from "./schedule-view";
import { useExhibitionSeason, useSeasonOverview } from "./season";

// `/calendario`, the sidebar «Calendar» (#593): every competition of the
// season in one calendar. With careers it will also hold scrims, training,
// transfers and events.

export function CalendarScreen({
	search,
	onSearch,
}: {
	search: CalendarSearch;
	/** Replaces the route's search in place (no new history entry). */
	onSearch: (search: CalendarSearch) => void;
}) {
	const { t } = useTranslation();
	const season = useExhibitionSeason();
	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.6vh,20px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{t("shell.nav.calendar")}
			</h1>
			{season.data && (
				<Season
					sessionId={season.data.sessionId}
					search={search}
					onSearch={onSearch}
				/>
			)}
			{season.error && <CoreErrorMessage error={season.error} />}
		</section>
	);
}

function Season({
	sessionId,
	search,
	onSearch,
}: {
	sessionId: number;
	search: CalendarSearch;
	onSearch: (search: CalendarSearch) => void;
}) {
	const navigate = useNavigate();
	const overview = useSeasonOverview(sessionId);
	if (!overview.data) return null;
	return (
		<ScheduleView
			sessionId={sessionId}
			overview={overview.data}
			filters={{
				scope: search.scope ?? ALL,
				team: search.team,
				mode: search.calendar ?? "week",
				day: search.day,
			}}
			onFilters={({ scope, team, mode, day }) =>
				onSearch({
					scope: scope === ALL ? undefined : scope,
					team,
					calendar: mode === "week" ? undefined : mode,
					day,
				})
			}
			onOpen={(slot) =>
				void navigate({
					to: "/competicion/serie/$series",
					params: { series: slot.id },
				})
			}
		/>
	);
}
