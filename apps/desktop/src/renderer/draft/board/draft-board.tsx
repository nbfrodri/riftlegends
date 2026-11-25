import type { DraftView, SeriesOptions, Side } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Check } from "lucide-react";
import {
	type KeyboardEvent,
	type MouseEvent,
	memo,
	useCallback,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { PlayerAge } from "../../player-age";
import { playSound } from "../../sound";
import { CountryFlag } from "../country-flag";
import { teamName, useDraftSession } from "../session";
import { TurnTimer } from "../turn-controls";
import {
	AI_PANEL_ID,
	AiDecisionPanel,
	useAiPanelOpen,
} from "./ai-decision-panel";
import { ChampionInspection } from "./champion-inspection";
import { ChampionPool, type PoolChampion } from "./champion-pool";
import {
	InspectionPanel,
	PlayerAttributes,
	PlayerPool,
	PlayerPortrait,
} from "./player-card";
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
			positions: options.positions[entry.champion] ?? [],
			unavailable: entry.status === "free" ? null : entry.status,
		}));
	}, [view.availability, options.champions, options.positions]);
}

/** Clicks here keep the selection: champions, players, controls and open panels (#469). */
const KEEPS_ON_CLICK =
	"button, a, input, select, textarea, label, details, [data-champion-card], [data-keep-selection]";
/** Escape here keeps the selection: search, inspection bars and the champion card. */
const KEEPS_ON_ESCAPE =
	"input, select, textarea, details, [data-champion-card]";
const inside = (target: EventTarget, selector: string) =>
	target instanceof Element && !!target.closest(selector);

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
		<div
			data-keep-selection
			className="-mx-[15px] mt-auto flex items-center justify-between gap-3.5 border-line border-t bg-surface px-[15px] py-[9px]"
		>
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
				data-silent-click
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
	// `undefined` shows the user's mid until a click; `null` is a cleared card.
	const [player, setPlayer] = useState<PlayerRef | null | undefined>();
	const [cardOpen, setCardOpen] = useState(false);
	const [aiOpen, setAiOpen] = useAiPanelOpen();
	const myMid = useMemo<PlayerRef | null>(
		() => (mine ? { team: mine, role: "mid" } : null),
		[mine],
	);
	if (!view) throw new Error("The draft board needs a series");
	const pool = usePool(view, options);
	const select = useCallback((id: string) => {
		setSelected(id);
		playSound("select");
	}, []);

	const showPlayer = useCallback((ref: PlayerRef) => {
		setPlayer(ref);
		setCardOpen(true);
	}, []);

	const shown = player === undefined ? myMid : player;

	// The board handles dismissal and selection clearing for all tiles (S1).
	const clear = () => {
		setSelected(null);
		setPlayer(null);
		setCardOpen(false);
	};
	const clearOnClick = (event: MouseEvent) => {
		if (aiOpen && !inside(event.target, `#${AI_PANEL_ID}`)) setAiOpen(false);
		if (!inside(event.target, KEEPS_ON_CLICK)) clear();
	};
	const clearOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
		if (
			event.key !== "Escape" ||
			event.currentTarget.querySelector("[data-champion-card]")
		)
			return;
		if (aiOpen) setAiOpen(false);
		else if (!inside(event.target, KEEPS_ON_ESCAPE)) clear();
	};
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
				first={view.first === side}
				team={team}
				options={options}
				current={picking}
				banning={turn?.action === "ban" && turn.side === side}
				// The selection previews in the picking row or the active ban slot.
				preview={myTurn && turn.side === side ? (choice?.id ?? null) : null}
				selected={shown?.team === team.team ? shown.role : null}
				onPlayer={showPlayer}
			/>
		);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: clears the selection on empty space; every control keeps its own handler.
		<div
			className="flex min-h-0 flex-[1_1_0px] flex-col gap-gap short:gap-3"
			onClick={clearOnClick}
			onKeyDown={clearOnEscape}
		>
			<Inspection
				player={shown}
				red={view.red.team}
				rivalSide={mine ? (mine === view.blue.team ? "red" : "blue") : null}
				rival={mine === view.blue.team ? view.red.team : view.blue.team}
				rivalPicks={mine === view.blue.team ? view.red.picks : view.blue.picks}
				game={view.game}
				options={options}
				cardOpen={cardOpen}
				onCardOpen={setCardOpen}
				aiOpen={aiOpen}
				onAiOpen={setAiOpen}
			/>
			<ChampionInspection>
				<TurnTimer />
				{column("blue")}
				<section
					aria-labelledby="pool-title"
					className="flex min-h-0 min-w-0 flex-col bg-panel px-[15px] pt-[13px]"
				>
					<ChampionPool
						champions={pool}
						selected={choice?.id ?? null}
						onSelect={select}
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
			</ChampionInspection>
		</div>
	);
}

/** The collapsible bars above the board: player card (U5) and AI read (#194). */
const Inspection = memo(function Inspection(props: {
	player: PlayerRef | null;
	red: string;
	rivalSide: Side | null;
	rival: string;
	rivalPicks: readonly string[];
	game: number;
	options: SeriesOptions;
	cardOpen: boolean;
	onCardOpen: (open: boolean) => void;
	aiOpen: boolean;
	onAiOpen: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const { options, player } = props;
	const championNames = useMemo(
		() => new Map(options.champions.map((c) => [c.id, c.name])),
		[options.champions],
	);
	const rated = options.teams
		.find((team) => team.id === player?.team)
		?.players.find((p) => p.role === player?.role);
	return (
		<div className="grid grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)] items-start gap-3">
			<InspectionPanel
				id="player-card"
				title={t("draft.board.playerCard")}
				note={
					player && (
						<>
							<CountryFlag country={rated?.nationality} />
							{t("draft.board.player", {
								handle: rated?.handle ?? "",
								team: teamName(options, player.team),
								role: t(`market.role.${player.role}`),
							})}
						</>
					)
				}
				open={props.cardOpen}
				onOpenChange={props.onCardOpen}
				accent={
					player?.team === props.red ? "border-side-red" : "border-side-blue"
				}
			>
				{rated ? (
					<div className="mt-2 flex items-start gap-3">
						<PlayerPortrait
							key={rated.id}
							id={rated.id}
							handle={rated.handle}
						/>
						<div className="min-w-0 flex-1">
							<p className="mb-1 text-[13px] text-muted">
								<PlayerAge birthDate={rated.birthDate} withUnit />
							</p>
							<PlayerAttributes
								attributes={rated.attributes}
								role={rated.role}
								estimated={rated.estimated}
							/>
							<PlayerPool pool={rated.pool} names={championNames} />
						</div>
					</div>
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
				picks={props.rivalPicks}
				side={props.rivalSide}
				open={props.aiOpen}
				onOpenChange={props.onAiOpen}
			/>
		</div>
	);
});
