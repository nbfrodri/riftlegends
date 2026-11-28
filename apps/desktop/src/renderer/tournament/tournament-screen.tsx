import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../shared/bridge";
import { useOptionalAssets } from "../assets";
import { LeagueLogo } from "../assets/league-logo";
import { SeasonScopeProvider } from "../competition/active-season";
import { useSeasonAdvance } from "../competition/advance";
import { AdvanceControls, RunProgress } from "../competition/advance-controls";
import { CompetitionHub, type HubSearch } from "../competition/competition-hub";
import { competitionLogoId, competitionName } from "../competition/names";
import { useSeasonOverview, useTeamNames } from "../competition/season";
import { SeriesScreen } from "../competition/series-screen";
import { CoreErrorMessage, CoreRequestError, useCore } from "../core";
import { DraftFlow } from "../draft/draft-screen";
import { SeasonSeriesProvider } from "../draft/session";
import { preloadSounds } from "../sound";
import { ChampionScreen } from "./champion-screen";
import { useMyTeamState } from "./my-team";
import {
	type TournamentRun,
	useTournamentRun,
	useTournamentSession,
} from "./tournament-run";
import { TournamentSetup } from "./tournament-setup";

/**
 * The `/torneo` route (plan 31): its own core session, so the tournament never
 * touches the draft or the exhibition season. First the setup (U9), then the
 * tournament's hub, the user's series in the draft flow and, at the end, the
 * champion (U10). A new tournament opens a new session.
 */
export function TournamentScreen({
	search = {},
	onSearch = async () => {},
}: {
	search?: HubSearch;
	onSearch?: (search: HubSearch) => Promise<void>;
}) {
	const session = useTournamentSession();
	if (session.data === undefined)
		return (
			<Page>
				<Intro />
				{session.error && <CoreErrorMessage error={session.error} />}
			</Page>
		);
	return (
		<Tournament
			key={session.data}
			sessionId={session.data}
			onNew={() => void session.restart()}
			search={search}
			onSearch={onSearch}
		/>
	);
}

const page =
	"flex h-full min-h-0 flex-col gap-gap px-gutter py-[clamp(16px,2.5vh,26px)] short:gap-3 short:py-3.5";

function Page({ children }: { children: React.ReactNode }) {
	return <section className={page}>{children}</section>;
}

function Intro() {
	const { t } = useTranslation();
	return (
		<header>
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] leading-none tracking-heading">
				{t("tournament.title")}
			</h1>
			<p className="mt-1.5 text-muted">{t("tournament.intro")}</p>
		</header>
	);
}

/** Draft-flow views that a new series of the user must not find cached. */
const SERIES_VIEWS = [
	"draft.view",
	"match.plan",
	"match.view",
	"series.summary",
];

function Tournament({
	sessionId,
	onNew,
	search,
	onSearch,
}: {
	sessionId: number;
	onNew: () => void;
	search: HubSearch;
	onSearch: (search: HubSearch) => Promise<void>;
}) {
	const { run, update, create, pendingStore } = useTournamentRun(sessionId);
	const core = useCore();
	const client = useQueryClient();
	const [failure, setFailure] = useState<CoreRequestError | null>(null);

	if (!run)
		return (
			<Page>
				<Intro />
				<TournamentSetup sessionId={sessionId} onCreated={create} />
			</Page>
		);
	if (run.playing && run.humanTeam)
		return <MySeries run={run} update={update} onLost={onNew} />;

	async function playMySeries(series: string) {
		if (!run) return;
		setFailure(null);
		const result = await core.send({
			v: CONTRACT_VERSION,
			kind: "season.playSeries",
			sessionId,
			expectedPosition: run.season.position.current,
			payload: { series, timer: false },
		});
		if (!result.ok) {
			setFailure(new CoreRequestError(result.error));
			return;
		}
		run.season.position.current = result.position;
		await Promise.all(
			SERIES_VIEWS.map((kind) =>
				client.resetQueries({ queryKey: ["core", sessionId, kind] }),
			),
		);
		update((current) => ({
			...current,
			pending: null,
			playing: { series, facts: result.facts },
		}));
	}

	return (
		<TournamentHub
			run={run}
			pendingStore={pendingStore}
			onPlayMySeries={(series) => void playMySeries(series)}
			onHub={() => update((current) => ({ ...current, hub: true }))}
			onNew={onNew}
			failure={failure}
			search={search}
			onSearch={onSearch}
		/>
	);
}

function TournamentHub({
	run,
	pendingStore,
	onPlayMySeries,
	onHub,
	onNew,
	failure,
	search,
	onSearch,
}: {
	run: TournamentRun;
	pendingStore: ReturnType<typeof useTournamentRun>["pendingStore"];
	onPlayMySeries: (series: string) => void;
	onHub: () => void;
	onNew: () => void;
	failure: CoreRequestError | null;
	search: HubSearch;
	onSearch: (search: HubSearch) => Promise<void>;
}) {
	const { t } = useTranslation();
	const { sessionId } = run.season;
	const overview = useSeasonOverview(sessionId);
	const advance = useSeasonAdvance(run.season, pendingStore);
	const teamName = useTeamNames(sessionId);
	const scope = useMemo(
		() => ({
			season: run.season,
			seriesRoute: "/torneo/serie/$series" as const,
		}),
		[run.season],
	);
	const view = overview.data;
	const competition = view?.competitions[0];
	if (!view || !competition)
		return (
			<Page>
				<Intro />
				{overview.error && <CoreErrorMessage error={overview.error} />}
			</Page>
		);
	const title = competitionName(t, competition.id);

	if (view.day === null && competition.champion && !run.hub)
		return (
			<Page>
				<TournamentTitle id={competition.id} title={title} />
				<ChampionScreen
					sessionId={sessionId}
					title={title}
					champion={competition.champion}
					mine={run.humanTeam}
					onHub={onHub}
					onNew={onNew}
				/>
			</Page>
		);

	const header = (
		<div className="grid gap-[clamp(8px,1.2vh,14px)]">
			<header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
				<TournamentTitle id={competition.id} title={title} />
				<AdvanceControls
					view={view}
					scope="tournament"
					run={advance.run}
					pending={advance.pending}
					busy={advance.busy}
					onStart={(mode) => void advance.start(mode)}
					onStop={advance.stop}
					teamName={teamName}
					onPlayMySeries={onPlayMySeries}
					onRestart={onNew}
				/>
			</header>
			{view.day === null && competition.champion ? (
				<p className="text-[14px]">
					{t("tournament.championLine", {
						team: teamName(competition.champion),
					})}
				</p>
			) : run.humanTeam ? (
				<MyTeamLine
					sessionId={sessionId}
					team={run.humanTeam}
					name={teamName(run.humanTeam)}
					view={view}
				/>
			) : (
				<p className="text-[14px] text-muted">{t("tournament.watching")}</p>
			)}
			{advance.run && (
				<RunProgress run={advance.run} year={view.year} scope="tournament" />
			)}
			{advance.error && <CoreErrorMessage error={advance.error} />}
			{failure && <CoreErrorMessage error={failure} />}
		</div>
	);
	return (
		<SeasonScopeProvider scope={scope}>
			<CompetitionHub
				competition={competition.id}
				search={search}
				onSearch={onSearch}
				header={header}
			/>
		</SeasonScopeProvider>
	);
}

function TournamentTitle({ id, title }: { id: string; title: string }) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<LeagueLogo
				id={competitionLogoId(id)}
				name={title}
				className="size-[clamp(32px,3vw,48px)]"
			/>
			<h1 className="min-w-0 truncate font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{title}
			</h1>
		</div>
	);
}

/** The user's team: in the tournament, out of it (spectator from then on) or champion. */
function MyTeamLine({
	sessionId,
	team,
	name,
	view,
}: {
	sessionId: number;
	team: string;
	name: string;
	view: Parameters<typeof useMyTeamState>[2];
}) {
	const { t } = useTranslation();
	const state = useMyTeamState(sessionId, team, view);
	return (
		<p role="status" className="text-[14px]">
			{state === "out" ? (
				<>
					<b className="font-semibold">{t("tournament.out", { team: name })}</b>{" "}
					<span className="text-muted">{t("tournament.outWatch")}</span>
				</>
			) : (
				<span className="text-muted">
					{t(state === "champion" ? "tournament.won" : "tournament.playing", {
						team: name,
					})}
				</span>
			)}
		</p>
	);
}

/** The user's series in the draft flow, back to the hub at its result. */
function MySeries({
	run,
	update,
	onLost,
}: {
	run: TournamentRun;
	update: ReturnType<typeof useTournamentRun>["update"];
	onLost: () => void;
}) {
	const { t } = useTranslation();
	const sounds = useOptionalAssets()?.sounds;
	useEffect(() => preloadSounds(sounds), [sounds]);
	const inSeason = useMemo(
		() => ({
			crumb: t("tournament.title"),
			exit: t("tournament.backToHub"),
			onExit: () => update((current) => ({ ...current, playing: null })),
		}),
		[t, update],
	);
	const onFacts = useMemo(
		() => (facts: readonly CoreFact[]) =>
			update((current) =>
				current.playing
					? {
							...current,
							playing: {
								...current.playing,
								facts: [...current.playing.facts, ...facts],
							},
						}
					: current,
			),
		[update],
	);
	if (!run.playing || !run.humanTeam) return null;
	return (
		<SeasonSeriesProvider
			sessionId={run.season.sessionId}
			position={run.season.position}
			facts={run.playing.facts}
			mine={run.humanTeam}
			inSeason={inSeason}
			onFacts={onFacts}
			onLost={onLost}
		>
			<DraftFlow />
		</SeasonSeriesProvider>
	);
}

/** `/torneo/serie/$series`: a played series of the tournament, read-only (U5). */
export function TournamentSeriesScreen({ series }: { series: string }) {
	const session = useTournamentSession();
	const { run } = useTournamentRun(session.data ?? -1);
	const scope = useMemo(
		() =>
			run && {
				season: run.season,
				seriesRoute: "/torneo/serie/$series" as const,
			},
		[run],
	);
	if (!scope) return null;
	return (
		<SeasonScopeProvider scope={scope}>
			<SeriesScreen series={series} />
		</SeasonScopeProvider>
	);
}
