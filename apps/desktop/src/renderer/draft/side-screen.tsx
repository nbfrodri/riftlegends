import {
	CONTRACT_VERSION,
	draftFacts,
	type MatchView,
	type SideChoice,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import {
	Circle,
	CircleCheck,
	ListEnd,
	ListStart,
	Map as MapIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCoreQueries, useFacts } from "../core";
import { ChampionPortrait } from "./champion-portrait";
import { type GameResult, readGame } from "./result-data";
import { championLabel, teamName, useDraftSession } from "./session";
import { SideSeriesPanel } from "./side-series-panel";

const panel = "flex flex-col gap-2 border-t-[3px] bg-panel p-3";
const panelTitle = "font-bold font-display text-lg tracking-heading";
const styles = {
	blue: { Icon: MapIcon, color: "text-side-blue", border: "border-side-blue" },
	red: { Icon: MapIcon, color: "text-side-red", border: "border-side-red" },
	// Blue and red belong to the map sides only (#376): the draft order is neutral.
	first: { Icon: ListStart, color: "text-text", border: "border-text" },
	last: { Icon: ListEnd, color: "text-text", border: "border-text" },
};

function ChoiceCard({
	choice,
	name,
	checked,
	select,
}: {
	choice: SideChoice;
	name: string;
	checked: boolean;
	select: () => void;
}) {
	const { t } = useTranslation();
	const id = useId();
	const { Icon, color, border } = styles[choice];
	const Mark = checked ? CircleCheck : Circle;
	return (
		<label
			className={`press relative cursor-pointer ${panel} ${border} hover:bg-surface has-[:checked]:bg-surface has-[:checked]:outline-2 has-[:checked]:outline-action has-[:focus-visible]:outline-3 outline-offset-[-2px]`}
		>
			<input
				type="radio"
				name={name}
				checked={checked}
				onChange={select}
				value={choice}
				aria-labelledby={id}
				aria-describedby={`${id}-about`}
				className="absolute size-px opacity-0"
			/>
			<span className="flex items-center gap-2">
				<Icon aria-hidden="true" className={`size-5 ${color}`} />
				<b id={id} className="font-display text-lg">
					{t(`draft.side.${choice}`)}
				</b>
				<Mark
					aria-hidden="true"
					className={`ml-auto size-5 ${checked ? "text-good" : "text-muted"}`}
				/>
			</span>
			<span id={`${id}-about`} className="text-sm text-muted">
				{t(`draft.side.${choice}.about`)}
			</span>
		</label>
	);
}

type AiChoice = Extract<
	ReturnType<typeof draftFacts.schema.parse>,
	{ type: "ai.sideDecided" }
>;

/** A team's champions locked by fearless, grouped by the game they were played in (#434). */
function PlayedBy(props: {
	team: string;
	games: readonly { game: number; champions: readonly string[] }[];
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const id = useId();
	return (
		<div className="flex min-w-0 flex-col gap-1.5 short:gap-1">
			<h3 id={id} className="font-bold">
				{t("draft.side.playedBy", { team: teamName(options, props.team) })}
			</h3>
			<ul aria-labelledby={id} className="flex flex-col gap-1 short:gap-0">
				{props.games.map(({ game, champions }) => {
					const playedIn = t("draft.side.playedIn", { game });
					return (
						<li key={game} className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="w-14 shrink-0 text-[13px] text-muted"
							>
								{t("draft.score.game", { game })}
							</span>
							<ul aria-label={playedIn} className="flex flex-wrap gap-1.5">
								{champions.map((champion) => {
									const name = championLabel(options, champion);
									// Greyed portraits like the bans, named by their tooltip (#376).
									return (
										<li key={champion} className="flex">
											<Tooltip heading={name} content={playedIn}>
												<span className="flex rounded-control">
													<ChampionPortrait
														id={champion}
														label={name}
														size="ban"
														unavailable
													/>
												</span>
											</Tooltip>
										</li>
									);
								})}
							</ul>
						</li>
					);
				})}
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
		props.games.map((game) => ({
			game: game.game,
			champions: game.lines
				.filter((l) => l.team === team)
				.map((l) => l.champion),
		}));
	return (
		<section aria-labelledby={id} className={`${panel} border-line`}>
			<h2 id={id} className={panelTitle}>
				{t("draft.side.locked")}
			</h2>
			<div className="grid grid-cols-2 gap-gap">
				{props.teams.map((team) => (
					<PlayedBy key={team} team={team} games={played(team)} />
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

export function SideScreen() {
	const { t, i18n } = useTranslation();
	const { view, options, mine, rules, send, present } = useDraftSession();
	const [selected, select] = useState<SideChoice>("blue");
	const [decision, setDecision] = useState<AiChoice | null>(null);
	useFacts((facts) => {
		for (const fact of facts) {
			if (fact.type !== "ai.sideDecided") continue;
			const parsed = draftFacts.schema.safeParse(fact);
			if (parsed.success && parsed.data.type === "ai.sideDecided")
				setDecision(parsed.data);
		}
	});
	const name = useId();
	const games = usePlayedGames((view?.game ?? 1) - 1);
	if (!view) return null;

	const turn = view.turn?.action === "side" ? view.turn : null;
	const priority = view.choices[0]?.team ?? turn?.team;
	if (!priority) return null;
	const teams = [view.blue.team, view.red.team];
	const rival = priority === view.blue.team ? view.red.team : view.blue.team;
	const choices = turn?.options ?? [];
	const choice = choices.includes(selected) ? selected : choices[0];
	const confirm = async () => {
		if (!turn || !choice) return;
		if (
			(await send("side.choose", { team: turn.team, choice })) &&
			view.choices.length === 1
		)
			present("side");
	};
	return (
		<>
			<p role="status" className="font-semibold">
				{t(view.game === 1 ? "draft.side.byDraw" : "draft.side.byLoss", {
					team: teamName(options, priority),
				})}
			</p>
			<div className="grid grid-cols-[2fr_1fr] items-start gap-gap">
				<div className="flex min-w-0 flex-col gap-3 short:gap-1">
					<ol
						aria-label={t("draft.side.decisions")}
						className="grid grid-cols-2 gap-gap"
					>
						{[priority, rival].map((team, index) => {
							const taken = view.choices[index]?.choice;
							return (
								<li
									key={team}
									className="min-w-0 border-l-2 border-line bg-panel px-3 py-2 short:py-1"
								>
									<p className="text-sm text-muted">
										{t(
											index === 0 ? "draft.side.priority" : "draft.side.reply",
										)}
									</p>
									<b>{teamName(options, team)}</b>
									<p>
										{taken
											? t(`draft.side.${taken}`)
											: t("draft.side.awaiting")}
									</p>
									{decision?.game === view.game &&
										decision.team === team &&
										taken && (
											<small className="text-muted">
												{t("draft.side.reason", {
													reason: decision.components.length
														? new Intl.ListFormat(i18n.language).format(
																decision.components.map(({ key }) =>
																	t(
																		`draft.aiPanel.factor.${key}` as "draft.aiPanel.factor.meta",
																	),
																),
															)
														: t("draft.side.variation"),
												})}
											</small>
										)}
								</li>
							);
						})}
					</ol>
					{turn?.team === mine && (
						<div
							role="radiogroup"
							aria-label={t("draft.side.label", {
								team: teamName(options, turn.team),
							})}
							className="grid grid-cols-2 gap-2 short:gap-1"
						>
							{choices.map((option) => (
								<ChoiceCard
									key={option}
									choice={option}
									name={name}
									checked={choice === option}
									select={() => select(option)}
								/>
							))}
						</div>
					)}
					{rules && rules.fearless !== "off" && view.game > 1 && (
						<LockedChampions
							games={games}
							teams={teams[1] === mine ? teams.reverse() : teams}
						/>
					)}
				</div>
				{rules && <SideSeriesPanel rules={rules} games={games} />}
			</div>
			{(!turn || turn.team === mine) && (
				<footer className="mt-auto flex justify-end border-line border-t pt-2">
					<Button onClick={() => (turn ? void confirm() : present(null))}>
						{t(turn ? "draft.side.confirm" : "draft.side.continue")}
					</Button>
				</footer>
			)}
		</>
	);
}
