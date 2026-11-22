import type { DraftView, SeriesOptions, Side } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Check } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { teamName, useDraftSession } from "../session";
import { AiDecisionPanel } from "./ai-decision-panel";
import { ChampionPool, type PoolChampion } from "./champion-pool";
import { InspectionPanel, PlayerAttributes } from "./player-card";
import { type PlayerRef, TeamColumn } from "./team-column";

type Turn = Extract<
	NonNullable<DraftView["turn"]>,
	{ action: "ban" | "pick" | "roles" }
>;

const draftTurn = (view: DraftView): Turn | null =>
	view.turn && "side" in view.turn && view.turn.action !== "roles"
		? view.turn
		: null;

function usePool(view: DraftView, options: SeriesOptions) {
	return useMemo(() => {
		const byId = new Map(options.champions.map((c) => [c.id, c]));
		return view.availability.map<PoolChampion>((entry) => ({
			id: entry.champion,
			name: byId.get(entry.champion)?.name ?? entry.champion,
			roles: byId.get(entry.champion)?.roles ?? [],
			unavailable: entry.status === "free" ? null : entry.status,
		}));
	}, [view.availability, options.champions]);
}

/** The bar under the grid: whose turn it is, the selection and Confirm. */
function TurnBar(props: {
	turn: Turn;
	view: DraftView;
	mine: boolean;
	selectedName: string | null;
	onConfirm: () => Promise<boolean>;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const { turn, view } = props;
	const [confirmedView, setConfirmedView] = useState<DraftView | null>(null);
	const busy = confirmedView === view;
	const confirm = async () => {
		setConfirmedView(view);
		// Keep this turn disabled until its new view arrives, or allow a retry on rejection.
		if (!(await props.onConfirm())) {
			setConfirmedView((previous) => (previous === view ? null : previous));
		}
	};
	const team = teamName(options, turn.team);
	const side = view[turn.side];
	const label =
		turn.action === "ban"
			? t("draft.board.turn.ban", { n: side.bans.length + 1, team })
			: t("draft.board.turn.pick", {
					slot: `${turn.side === "blue" ? "B" : "R"}${side.picks.length + 1}`,
					team,
				});
	return (
		<div className="-mx-[15px] mt-auto flex items-center justify-between gap-3.5 border-line border-t bg-surface px-[15px] py-[9px]">
			<div aria-live="polite" className="min-w-0">
				<p className="font-semibold text-[11px] text-action uppercase tracking-[0.055em]">
					{label}
				</p>
				{props.mine ? (
					<h2 className="truncate font-bold font-display text-[clamp(24px,2.5vw,38px)] leading-tight tracking-champion">
						{props.selectedName ?? t("draft.board.choose")}
					</h2>
				) : (
					<p
						role="status"
						className="font-bold font-display text-[clamp(20px,2vw,30px)] text-muted leading-tight tracking-champion"
					>
						{t("draft.board.theirTurn", { team })}
					</p>
				)}
			</div>
			<Button
				disabled={!props.mine || !props.selectedName || busy}
				onClick={() => void confirm()}
			>
				<Check aria-hidden="true" className="size-4" />
				{t(`draft.board.confirm.${turn.action === "ban" ? "ban" : "pick"}`)}
			</Button>
		</div>
	);
}

/**
 * U3 and U5: the draft board. Both sides' picks and bans, the champion pool
 * and, on the user's turn, Confirm sends `draft.ban` or `draft.pick`. On the
 * AI's turn the board shows the acting team until the core confirms its move.
 */
export function DraftBoard() {
	const { view, options, mine, send } = useDraftSession();
	const [selected, setSelected] = useState<string | null>(null);
	const [player, setPlayer] = useState<PlayerRef | null>(null);
	const [cardOpen, setCardOpen] = useState(false);
	const myMid = useMemo<PlayerRef | null>(
		() => (mine ? { team: mine, role: "mid" } : null),
		[mine],
	);
	if (!view) throw new Error("The draft board needs a series");
	const pool = usePool(view, options);

	const showPlayer = useCallback((ref: PlayerRef) => {
		setPlayer(ref);
		setCardOpen(true);
	}, []);

	const turn = draftTurn(view);
	const myTurn = turn !== null && turn.team === mine;
	const choice = pool.find((c) => c.id === selected && c.unavailable === null);

	const confirm = () => {
		if (!turn || !myTurn || !choice) return Promise.resolve(false);
		const kind = turn.action === "ban" ? "draft.ban" : "draft.pick";
		// The refreshed availability clears the selection in the same render as the lockout.
		return send(kind, { team: turn.team, champion: choice.id });
	};

	const column = (side: Side) => {
		const team = view[side];
		const picking =
			myTurn && turn.action === "pick" && turn.side === side
				? team.picks.length
				: null;
		return (
			<TeamColumn
				side={side}
				team={team}
				options={options}
				current={picking}
				onPlayer={showPlayer}
			/>
		);
	};

	return (
		<>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-3">
				{column("blue")}
				<section
					aria-labelledby="pool-title"
					className="flex min-h-0 min-w-0 flex-col bg-panel px-[15px] pt-[13px]"
				>
					<ChampionPool
						champions={pool}
						selected={choice?.id ?? null}
						onSelect={setSelected}
					/>
					{turn && (
						<TurnBar
							turn={turn}
							view={view}
							mine={myTurn}
							selectedName={choice?.name ?? null}
							onConfirm={confirm}
						/>
					)}
				</section>
				{column("red")}
			</div>
			<Inspection
				player={player ?? myMid}
				red={view.red.team}
				rivalSide={mine ? (mine === view.blue.team ? "red" : "blue") : null}
				rival={mine === view.blue.team ? view.red.team : view.blue.team}
				game={view.game}
				options={options}
				cardOpen={cardOpen}
				onCardOpen={setCardOpen}
			/>
		</>
	);
}

/** The collapsible panels under the board: player card (U5) and AI read (#194). */
const Inspection = memo(function Inspection(props: {
	player: PlayerRef | null;
	red: string;
	rivalSide: Side | null;
	rival: string;
	game: number;
	options: SeriesOptions;
	cardOpen: boolean;
	onCardOpen: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const { options, player } = props;
	const rated = options.teams
		.find((team) => team.id === player?.team)
		?.players.find((p) => p.role === player?.role);
	return (
		<div className="grid grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)] items-start gap-3">
			<InspectionPanel
				id="player-card"
				title={t("draft.board.playerCard")}
				note={
					player
						? t("draft.board.player", {
								handle: rated?.handle ?? "",
								team: teamName(options, player.team),
								role: t(`market.role.${player.role}`),
							})
						: undefined
				}
				open={props.cardOpen}
				onOpenChange={props.onCardOpen}
				accent={
					player?.team === props.red ? "border-side-red" : "border-side-blue"
				}
			>
				{rated ? (
					<PlayerAttributes
						attributes={rated.attributes}
						estimated={rated.estimated}
					/>
				) : (
					<p className="mt-2 text-[13px] text-muted">
						{t("draft.board.playerHint")}
					</p>
				)}
			</InspectionPanel>
			<AiDecisionPanel
				key={props.game}
				game={props.game}
				options={options}
				rival={props.rivalSide ? props.rival : null}
				side={props.rivalSide}
			/>
		</div>
	);
});
