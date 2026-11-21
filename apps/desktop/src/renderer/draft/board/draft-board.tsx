import type { DraftView, Role, SeriesOptions } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { teamName, useDraftSession } from "../session";
import { ChampionPool, type PoolChampion } from "./champion-pool";
import { championName, slotRoles } from "./champions";
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
		const roles = new Map(options.champions.map((c) => [c.id, c.roles]));
		const champions: PoolChampion[] = view.availability.map((entry) => ({
			id: entry.champion,
			roles: roles.get(entry.champion) ?? [],
			unavailable: entry.status === "free" ? null : entry.status,
		}));
		const rolesOf = (id: string): readonly Role[] => roles.get(id) ?? [];
		return { champions, rolesOf };
	}, [view.availability, options.champions]);
}

/** The bar under the grid: whose turn it is, the selection and Confirm. */
function TurnBar(props: {
	turn: Turn;
	view: DraftView;
	mine: boolean;
	selected: string | null;
	busy: boolean;
	onConfirm: () => void;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const { turn, view } = props;
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
						{props.selected
							? championName(props.selected)
							: t("draft.board.choose")}
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
				disabled={!props.mine || !props.selected || props.busy}
				onClick={props.onConfirm}
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
 * AI's turn the board only says whose turn it is (its moves are #193).
 */
export function DraftBoard() {
	const { t } = useTranslation();
	const { view, options, mine, send } = useDraftSession();
	const [selected, setSelected] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [player, setPlayer] = useState<PlayerRef | null>(null);
	const [cardOpen, setCardOpen] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);
	if (!view) throw new Error("The draft board needs a series");
	const pool = usePool(view, options);

	const showPlayer = useCallback((ref: PlayerRef) => {
		setPlayer(ref);
		setCardOpen(true);
	}, []);

	const turn = draftTurn(view);
	const myTurn = turn !== null && turn.team === mine;
	const choice = pool.champions.find(
		(c) => c.id === selected && c.unavailable === null,
	);

	const confirm = async () => {
		if (!turn || !myTurn || !choice) return;
		setBusy(true);
		const kind = turn.action === "ban" ? "draft.ban" : "draft.pick";
		if (await send(kind, { team: turn.team, champion: choice.id })) {
			setSelected(null);
		}
		setBusy(false);
	};

	const column = (side: "blue" | "red") => {
		const { team, picks, bans } = view[side];
		const picking =
			myTurn && turn.action === "pick" && turn.side === side
				? picks.length
				: null;
		return (
			<TeamColumn
				side={side}
				team={{ id: team, name: teamName(options, team) }}
				picks={picks}
				bans={bans}
				roles={slotRoles(picks, pool.rolesOf)}
				current={picking}
				onPlayer={showPlayer}
			/>
		);
	};

	const shown = player ?? (mine ? { team: mine, role: "mid" as const } : null);
	const attributes = options.teams
		.find((team) => team.id === shown?.team)
		?.players.find((p) => p.role === shown?.role)?.attributes;

	return (
		<>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-3">
				{column("blue")}
				<ChampionPool
					champions={pool.champions}
					selected={choice?.id ?? null}
					onSelect={setSelected}
				>
					{turn && (
						<TurnBar
							turn={turn}
							view={view}
							mine={myTurn}
							selected={choice?.id ?? null}
							busy={busy}
							onConfirm={() => void confirm()}
						/>
					)}
				</ChampionPool>
				{column("red")}
			</div>
			<div className="grid grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)] items-start gap-3">
				<InspectionPanel
					id="player-card"
					title={t("draft.board.playerCard")}
					note={
						shown
							? t("draft.board.player", {
									team: teamName(options, shown.team),
									role: t(`market.role.${shown.role}`),
								})
							: undefined
					}
					open={cardOpen}
					onOpenChange={setCardOpen}
					accent={
						shown?.team === view.red.team
							? "border-side-red"
							: "border-side-blue"
					}
				>
					{attributes ? (
						<PlayerAttributes attributes={attributes} />
					) : (
						<p className="mt-2 text-[13px] text-muted">
							{t("draft.board.playerHint")}
						</p>
					)}
				</InspectionPanel>
				<InspectionPanel
					id="ai-read"
					title={t("draft.board.aiRead")}
					open={aiOpen}
					onOpenChange={setAiOpen}
					accent="border-side-red"
				>
					<p className="mt-2 text-[13px] text-muted">
						{t("draft.board.aiReadEmpty")}
					</p>
				</InspectionPanel>
			</div>
		</>
	);
}
