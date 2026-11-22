import {
	CONTRACT_VERSION,
	type MatchView,
	type Side,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import {
	ArrowRight,
	Circle,
	CircleCheck,
	ListEnd,
	ListStart,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCoreQueries } from "../core";
import { type GameResult, readGame } from "./result-data";
import { championLabel, teamName, useDraftSession } from "./session";
import { SideSeriesPanel } from "./side-series-panel";

/** The picks of each side in the pro order (plan 06): red closes the draft. */
const PICKS: Record<Side, readonly number[]> = {
	blue: [1, 4, 5, 8, 9],
	red: [2, 3, 6, 7, 10],
};
/** The first pick after the second bans. */
const SECOND_PHASE = 7;
const SIDES = ["blue", "red"] as const;
const sideText = { blue: "text-side-blue", red: "text-side-red" };
const sideBorder = { blue: "border-side-blue", red: "border-side-red" };
const sideFill = { blue: "bg-side-blue", red: "bg-side-red" };
/** First pick opens the draft; last pick closes it. */
const RoleIcon = { blue: ListStart, red: ListEnd };
const panel =
	"flex flex-col gap-3 border-t-[3px] bg-panel p-4 short:gap-2 short:p-3";
const panelTitle = "font-bold font-display text-lg tracking-heading";

/** The ten picks of a draft, with this side's filled in its colour. */
function PickOrder({ side }: { side: Side }) {
	const { t, i18n } = useTranslation();
	const own = PICKS[side];
	const list = new Intl.ListFormat(i18n.language, {
		style: "long",
		type: "conjunction",
	}).format(own.map(String));
	return (
		<span
			role="img"
			aria-label={t("draft.side.picks", { list })}
			className="mt-auto flex gap-1"
		>
			{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
				<span
					key={n}
					className={`grid h-7 flex-1 place-items-center rounded-control text-[13px] tabular-nums ${n === SECOND_PHASE ? "ml-2.5" : ""} ${
						own.includes(n)
							? `${sideFill[side]} font-bold text-on-action`
							: "border border-line text-muted"
					}`}
				>
					{n}
				</span>
			))}
		</span>
	);
}

/** What a side means; a radio when the user chooses, with its team once chosen. */
function SideCard(props: {
	side: Side;
	team?: string | undefined;
	choice?: { name: string; checked: boolean; onChange: () => void };
}) {
	const { t } = useTranslation();
	const id = useId();
	const { side, team, choice } = props;
	const Icon = RoleIcon[side];
	const content = (
		<>
			<div className="flex items-center justify-between gap-3">
				<h3
					id={`${id}-title`}
					className={`font-bold font-display text-[clamp(20px,1.8vw,28px)] tracking-heading ${sideText[side]}`}
				>
					{t(`draft.side.${side}`)}
				</h3>
				{team && (
					<span className="truncate font-bold font-display text-lg tracking-team">
						{team}
					</span>
				)}
				{choice &&
					(choice.checked ? (
						<CircleCheck aria-hidden="true" className="size-6 text-action" />
					) : (
						<Circle aria-hidden="true" className="size-6 text-muted" />
					))}
			</div>
			<p id={`${id}-about`} className="flex flex-col gap-1">
				<b className="flex items-center gap-2 text-lg">
					<Icon aria-hidden="true" className={`size-5 ${sideText[side]}`} />
					{t(`draft.side.${side}.role`)}
				</b>
				<span className="text-muted">{t(`draft.side.${side}.about`)}</span>
			</p>
			<PickOrder side={side} />
		</>
	);
	const box = `relative ${panel} ${sideBorder[side]}`;
	if (!choice) return <div className={box}>{content}</div>;
	return (
		<label
			className={`${box} cursor-pointer outline-offset-[-2px] hover:bg-surface has-[:checked]:bg-surface has-[:checked]:outline-2 has-[:checked]:outline-action has-[:focus-visible]:outline-3`}
		>
			<input
				type="radio"
				name={choice.name}
				value={side}
				checked={choice.checked}
				onChange={choice.onChange}
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-about`}
				className="absolute size-px opacity-0"
			/>
			{content}
		</label>
	);
}

/** The champions a team played in earlier games, which fearless locks. */
function PlayedBy(props: { team: string; champions: readonly string[] }) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const id = useId();
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<h3 id={id} className="font-bold">
				{t("draft.side.playedBy", { team: teamName(options, props.team) })}
			</h3>
			<ul
				aria-labelledby={id}
				className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5"
			>
				{props.champions.map((champion) => (
					<li
						key={champion}
						className="flex h-[clamp(44px,7vh,56px)] min-w-0 flex-col overflow-hidden rounded-control bg-surface"
					>
						<ChampionFace id={champion} size="pool" unavailable />
						<span className="truncate px-1 py-0.5 font-medium text-[12px] text-muted">
							{championLabel(options, champion)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Who played what in the games already played, which fearless locks. */
function LockedChampions(props: {
	games: readonly GameResult[];
	teams: readonly string[];
}) {
	const { t } = useTranslation();
	const id = useId();
	const played = (team: string) =>
		props.games.flatMap((game) =>
			game.lines.filter((l) => l.team === team).map((l) => l.champion),
		);
	return (
		<section aria-labelledby={id} className={`${panel} border-line`}>
			<h2 id={id} className={panelTitle}>
				{t("draft.side.locked")}
			</h2>
			<div className="grid grid-cols-2 gap-gap">
				{props.teams.map((team) => (
					<PlayedBy key={team} team={team} champions={played(team)} />
				))}
			</div>
		</section>
	);
}

/**
 * The games before the current one, from their `match.view`. The draft view
 * cannot tell: until the next draft starts, it still holds the last game.
 */
function usePlayedGames(count: number): GameResult[] {
	const { sessionId } = useDraftSession();
	const queries = useCoreQueries<MatchView>(
		Array.from({ length: count }, (_, i) => ({
			v: CONTRACT_VERSION,
			kind: "match.view",
			sessionId,
			params: { game: i + 1 },
		})),
	);
	return queries.flatMap(({ data }) => {
		const game = data ? readGame(data) : null;
		return game ? [game] : [];
	});
}

/**
 * U2: the chooser picks blue or red, seeing what each side means, the series
 * and what fearless has locked. The AI's choice shows until the user continues.
 */
export function SideScreen() {
	const { t } = useTranslation();
	const { view, options, mine, rules, send, present, presentation } =
		useDraftSession();
	const [side, setSide] = useState<Side>("blue");
	const name = useId();
	const games = usePlayedGames((view?.game ?? 1) - 1);

	if (!view) return null;

	const chooser = view.phase === "side" ? view.turn?.team : undefined;
	const chosen = presentation === "side";
	const choosing = !chosen && chooser !== undefined && chooser === mine;
	const chooserName = teamName(options, chooser ?? "");
	const rival = mine === view.blue.team ? view.red.team : view.blue.team;

	const status = chosen
		? t("draft.side.aiChose", { team: teamName(options, rival) })
		: choosing
			? t("draft.side.youChoose", { team: chooserName })
			: t("draft.side.aiChoosing", { team: chooserName });
	const teams =
		mine === view.red.team
			? [view.red.team, view.blue.team]
			: [view.blue.team, view.red.team];

	return (
		<>
			<div className="grid grid-cols-[2fr_1fr] items-start gap-gap">
				<div className="flex min-w-0 flex-col gap-3">
					<p role="status" className="flex flex-wrap gap-x-3">
						<b>{status}</b>
						{!chosen && (
							<span className="text-muted">
								{view.game === 1
									? t("draft.side.bySeed")
									: t("draft.side.byLoss")}
							</span>
						)}
					</p>
					{choosing ? (
						<div
							role="radiogroup"
							aria-label={t("draft.side.label", { team: chooserName })}
							className="grid grid-cols-2 gap-gap"
						>
							{SIDES.map((s) => (
								<SideCard
									key={s}
									side={s}
									choice={{
										name,
										checked: side === s,
										onChange: () => setSide(s),
									}}
								/>
							))}
						</div>
					) : (
						<div className="grid grid-cols-2 gap-gap">
							{SIDES.map((s) => (
								<SideCard
									key={s}
									side={s}
									team={chosen ? teamName(options, view[s].team) : undefined}
								/>
							))}
						</div>
					)}
				</div>
				{rules && <SideSeriesPanel rules={rules} games={games} />}
			</div>
			{rules && rules.fearless !== "off" && view.game > 1 && (
				<LockedChampions games={games} teams={teams} />
			)}
			{(chosen || choosing) && (
				<footer className="mt-auto flex justify-end border-line border-t pt-[14px]">
					<Button
						onClick={() =>
							chosen
								? present(null)
								: void send("side.choose", { team: chooser, side })
						}
					>
						{t("draft.side.continue")}
						<ArrowRight aria-hidden="true" className="size-4" />
					</Button>
				</footer>
			)}
		</>
	);
}
