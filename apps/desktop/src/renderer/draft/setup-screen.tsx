import type { SeriesOptions } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import {
	SearchSelect,
	type SearchSelectGroup,
} from "@rift-legends/ui-kit/components/search-select";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../assets/league-logo";
import { useRealBlock } from "./real-content";
import { useDraftSession } from "./session";
import { TeamCrest } from "./team-crest";

/** Leagues in the order the team selector lists them (plan 11, A2). */
/** The real leagues in their usual order (plan 11). */
export const LEAGUES = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];

type Team = SeriesOptions["teams"][number];

const FORMATS = ["bo1", "bo3", "bo5"] as const;
const FEARLESS = ["hard", "soft", "off"] as const;
const TIMER = ["off", "on"] as const;

type Format = (typeof FORMATS)[number];
type Fearless = (typeof FEARLESS)[number];
type Timer = (typeof TIMER)[number];

function Rule(props: {
	title: string;
	note: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-line border-t py-[clamp(8px,1.2vh,19px)]">
			<div>
				<h3 className="font-semibold">{props.title}</h3>
				<p className="mt-1 text-[13px] text-muted">{props.note}</p>
			</div>
			{props.children}
		</div>
	);
}

/** The teams grouped by league, each group by seed; without leagues, one group. */
export function teamGroups(
	teams: readonly Team[],
	seedLabel: (n: number) => string,
): SearchSelectGroup[] {
	const item = (team: Team) => ({
		value: team.id,
		label: team.name,
		detail: seedLabel(team.seed),
	});
	const leagues = [...new Set(teams.flatMap((team) => team.league ?? []))];
	if (leagues.length === 0) return [{ items: teams.map(item) }];
	const rank = (league: string) =>
		LEAGUES.includes(league) ? LEAGUES.indexOf(league) : LEAGUES.length;
	return leagues
		.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
		.map((league) => ({
			label: league,
			icon: <LeagueLogo id={league} name={league} />,
			items: teams.filter((team) => team.league === league).map(item),
		}));
}

function TeamCard(props: {
	label: string;
	team: Team;
	groups: readonly SearchSelectGroup[];
	onChange: (id: string) => void;
	side: "blue" | "red";
}) {
	const { t } = useTranslation();
	const color = props.side === "blue" ? "text-side-blue" : "text-side-red";
	const border = props.side === "blue" ? "border-side-blue" : "border-side-red";
	return (
		<section className={`border-t-[3px] bg-panel ${border}`}>
			<div
				className={`flex h-[clamp(96px,14vh,150px)] items-center justify-between gap-4 bg-panel px-6 py-[18px] ${color}`}
			>
				<div className="min-w-0">
					<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
						{props.label}
					</p>
					<Tooltip content={props.team.name}>
						<h2 className="mt-1 truncate font-bold font-display text-[clamp(28px,3vw,42px)] text-text leading-none tracking-team">
							{props.team.name}
						</h2>
					</Tooltip>
					<p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
						{props.team.league && (
							<span aria-hidden="true">
								<LeagueLogo id={props.team.league} name={props.team.league} />
							</span>
						)}
						{props.team.league
							? t("draft.setup.leagueSeed", {
									league: props.team.league,
									n: props.team.seed,
								})
							: t("draft.setup.seed", { n: props.team.seed })}
					</p>
				</div>
				<span className="shrink-0">
					<TeamCrest id={props.team.id} name={props.team.name} />
				</span>
			</div>
			<div className="flex items-center justify-between gap-4 border-line border-t px-5 py-[10px]">
				<span>{t("draft.setup.club")}</span>
				<SearchSelect
					label={props.label}
					searchLabel={t("draft.setup.searchTeam")}
					empty={t("draft.setup.noTeam")}
					groups={props.groups}
					value={props.team.id}
					onChange={props.onChange}
					className="w-56 max-w-full"
				/>
			</div>
		</section>
	);
}

/** U1: teams, format, fearless and timer. The rival's coach is information only. */
export function SetupScreen() {
	const { t, i18n } = useTranslation();
	const { options, send, setMine, sessionId, content } = useDraftSession();
	const block = useRealBlock(sessionId);
	// Best seed first: the selectors and the default pairing follow it.
	const teams = useMemo(
		() => options.teams.slice().sort((a, b) => a.seed - b.seed),
		[options.teams],
	);
	const groups = useMemo(
		() => teamGroups(teams, (n) => t("draft.setup.seed", { n })),
		[teams, t],
	);
	const [first, second] = teams;
	const [mineId, setMineId] = useState(first?.id);
	const [rivalId, setRivalId] = useState(second?.id);
	const [format, setFormat] = useState<Format>("bo3");
	const [fearless, setFearless] = useState<Fearless>("hard");
	const [timer, setTimer] = useState<Timer>("off");
	const [starting, setStarting] = useState(false);

	// A content change brings other teams: fall back to the two best seeds.
	const mine = teams.find((team) => team.id === mineId) ?? first;
	const rival =
		teams.find((team) => team.id === rivalId && team.id !== mine?.id) ??
		teams.find((team) => team.id !== mine?.id);
	if (!mine || !rival) return null;

	// A team cannot face itself: taking the rival's team gives it mine.
	const chooseMine = (id: string) => {
		setRivalId(id === rival.id ? mine.id : rival.id);
		setMineId(id);
	};
	const chooseRival = (id: string) => {
		setMineId(id === mine.id ? rival.id : mine.id);
		setRivalId(id);
	};

	const coach = rival.coach;
	const level = new Intl.NumberFormat(i18n.language, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format((coach?.rating ?? 0) / 10);
	const personality = coach?.personality ?? "balanced";

	async function start() {
		if (!mine || !rival || (content === "real" && block)) return;
		setStarting(true);
		const ok = await send("series.start", {
			teams: [mine.id, rival.id],
			format,
			fearless,
			timer: timer === "on",
			pool: options.pool,
			seed: crypto.getRandomValues(new Uint32Array(1))[0],
			ai: [null, "coach"],
			...(content === "real" && { content }),
		});
		if (ok) setMine(mine.id);
		else setStarting(false);
	}

	return (
		<>
			<div className="grid grid-cols-2 gap-gap">
				<TeamCard
					label={t("draft.setup.myTeam")}
					team={mine}
					groups={groups}
					onChange={chooseMine}
					side="blue"
				/>
				<TeamCard
					label={t("draft.setup.rivalTeam")}
					team={rival}
					groups={groups}
					onChange={chooseRival}
					side="red"
				/>
			</div>
			<div className="grid grid-cols-[1.6fr_1fr] gap-gap">
				<section className="bg-panel p-[clamp(16px,1.65vw,26px)]">
					<h2 className="mb-[13px] font-bold font-display text-xl tracking-heading">
						{t("draft.setup.rules")}
					</h2>
					<Rule
						title={t("draft.setup.format")}
						note={t("draft.setup.formatNote")}
					>
						<SegmentedControl
							label={t("draft.setup.format")}
							options={FORMATS.map((value) => ({
								value,
								label: t(`draft.setup.format.${value}`),
							}))}
							value={format}
							onChange={setFormat}
						/>
					</Rule>
					<Rule
						title={t("draft.setup.fearless")}
						note={t(`draft.setup.fearlessNote.${fearless}`)}
					>
						<SegmentedControl
							label={t("draft.setup.fearless")}
							options={FEARLESS.map((value) => ({
								value,
								label: t(`draft.setup.fearless.${value}`),
							}))}
							value={fearless}
							onChange={setFearless}
						/>
					</Rule>
					<Rule
						title={t("draft.setup.timer")}
						note={t("draft.setup.timerNote")}
					>
						<SegmentedControl
							label={t("draft.setup.timer")}
							options={TIMER.map((value) => ({
								value,
								label: t(`draft.setup.timer.${value}`),
							}))}
							value={timer}
							onChange={setTimer}
						/>
					</Rule>
				</section>
				<aside
					aria-label={t("draft.coach.label")}
					className="bg-panel p-[clamp(16px,1.65vw,26px)]"
				>
					<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
						{t("draft.coach.label")}
					</p>
					<h2 className="mt-[7px] mb-1 font-bold font-display text-[30px] leading-tight tracking-heading">
						{coach?.name ?? t("draft.coach.none")}
					</h2>
					<p className="text-muted">
						{t("draft.coach.of", { team: rival.name })}
					</p>
					<dl className="my-[14px] space-y-1.5 border-line border-y py-[11px]">
						<div className="flex items-baseline justify-between gap-1">
							<dt className="text-muted">{t("draft.coach.personality")}</dt>
							<dd className="font-semibold">
								{t(`draft.personality.${personality}.name`)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-1">
							<dt className="text-muted">{t("draft.coach.level")}</dt>
							<dd className="font-semibold">
								{t("draft.coach.levelValue", { value: level })}
							</dd>
						</div>
					</dl>
					<p>{t(`draft.personality.${personality}.note`)}</p>
				</aside>
			</div>
			<footer className="mt-auto flex items-center justify-between gap-4 border-line border-t pt-[14px] text-muted">
				<span>{t("draft.setup.drawNote")}</span>
				<Button
					disabled={starting || (content === "real" && block !== null)}
					onClick={() => void start()}
				>
					{t("draft.setup.start")}
				</Button>
			</footer>
		</>
	);
}
