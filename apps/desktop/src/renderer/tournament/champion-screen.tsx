import {
	CONTRACT_VERSION,
	type MatchView,
	type SeriesSummary,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { useTranslation } from "react-i18next";
import type { ScheduleSlot } from "../competition/schedule-view";
import { useCoreQueries, useCoreQuery } from "../core";
import { readGame } from "../draft/result-data";
import { Mvp } from "../draft/result-series";
import {
	SeriesContentProvider,
	teamName,
	useSeriesOptions,
} from "../draft/session";
import { TeamCrest } from "../draft/team-crest";

// The end of a tournament (plan 31, U10): the champion with its logo, the
// final and its MVP, then a new tournament or the hub of the one just played.

const never = () => false;

export function ChampionScreen(props: {
	sessionId: number;
	title: string;
	champion: string;
	mine: string | null;
	onHub: () => void;
	onNew: () => void;
}) {
	return (
		<SeriesContentProvider sessionId={props.sessionId}>
			<Champion {...props} />
		</SeriesContentProvider>
	);
}

function Champion({
	sessionId,
	title,
	champion,
	mine,
	onHub,
	onNew,
}: {
	sessionId: number;
	title: string;
	champion: string;
	mine: string | null;
	onHub: () => void;
	onNew: () => void;
}) {
	const { t } = useTranslation();
	const options = useSeriesOptions();
	const name = teamName(options, champion);
	const schedule = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: {},
		},
		{ affectedBy: never },
	);
	const final = schedule.data
		?.filter(({ status }) => status === "played")
		.at(-1);
	const summary = useCoreQuery<SeriesSummary>(
		{
			v: CONTRACT_VERSION,
			kind: "series.summary",
			sessionId,
			params: { series: final?.id ?? "" },
		},
		{ affectedBy: never, enabled: final !== undefined },
	);
	const played = summary.data?.lanes.length ?? 0;
	const maps = useCoreQueries<MatchView>(
		Array.from({ length: played }, (_, i) => ({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId,
			params: { series: final?.id ?? "", game: i + 1 },
		})),
	);
	const games = maps
		.map((map) => (map.data ? readGame(map.data) : null))
		.filter((game) => game !== null);
	const mvp = summary.data?.mvp;
	const [a, b] = final?.teams ?? [null, null];
	const [scoreA, scoreB] = final?.score ?? [0, 0];
	const blue = games[0]?.blue;
	return (
		<section
			aria-labelledby="tournament-champion"
			className="flex min-h-0 flex-1 flex-col gap-[clamp(12px,2vh,22px)]"
		>
			<div className="flex items-center gap-[clamp(16px,2vw,32px)] border-action border-t-[3px] bg-panel px-[clamp(16px,2vw,32px)] py-[clamp(14px,2.4vh,28px)]">
				<TeamCrest
					id={champion}
					name={name}
					className="h-[clamp(72px,10vh,120px)] w-[clamp(96px,8vw,160px)] shrink-0"
				/>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.06em]">
						{t("tournament.champion.label", { tournament: title })}
					</p>
					<h2
						id="tournament-champion"
						className="mt-1.5 truncate font-bold font-display text-[clamp(32px,3.4vw,60px)] uppercase leading-none tracking-heading"
					>
						{name}
					</h2>
					{a && b && (
						<p className="mt-2 text-[15px]">
							{t("tournament.champion.final", {
								a: teamName(options, a),
								b: teamName(options, b),
								scoreA,
								scoreB,
							})}
						</p>
					)}
					{mine && (
						<p className="mt-1 text-muted">
							{mine === champion
								? t("tournament.champion.mine")
								: t("tournament.champion.notMine", {
										team: teamName(options, mine),
									})}
						</p>
					)}
				</div>
				<div className="flex shrink-0 flex-col gap-2">
					<Button onClick={onNew}>{t("tournament.new")}</Button>
					<Button variant="secondary" onClick={onHub}>
						{t("tournament.champion.hub")}
					</Button>
				</div>
			</div>
			{mvp && games.length > 0 && (
				<Mvp
					mvp={mvp}
					games={games}
					sideOf={(team) => (team === blue ? "blue" : "red")}
				/>
			)}
		</section>
	);
}
