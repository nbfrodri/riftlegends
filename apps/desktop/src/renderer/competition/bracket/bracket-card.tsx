import type { BracketView } from "@rift-legends/contracts";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import { CARD_H, CARD_W } from "./bracket-layout";

type Match = BracketView["matches"][number];
type Slot = Match["from"][number];

export interface SlotText {
	/** The team, or where it will come from while it is not known. */
	name: string;
	known: boolean;
	/** A top seed that skipped the first round. */
	bye: boolean;
}

/** The two slots of a series, in the order of `teamA` and `teamB`. */
export function slotTexts(
	match: Match,
	teamName: (id: string) => string,
	origin: (slot: Slot) => string,
): [SlotText, SlotText] {
	const text = (team: string | null, slot: Slot): SlotText => ({
		name: team ? teamName(team) : origin(slot),
		known: team !== null,
		bye: slot.kind === "seed" && match.side === "upper" && match.round > 1,
	});
	return [text(match.teamA, match.from[0]), text(match.teamB, match.from[1])];
}

function Row({
	team,
	slot,
	score,
	result,
}: {
	team: string | null;
	slot: SlotText;
	score: number | undefined;
	result: "won" | "lost" | undefined;
}) {
	const { t } = useTranslation();
	return (
		<span
			data-result={result}
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2 px-2.5 text-[13px]",
				result === "won" && "font-semibold text-text",
				result === "lost" && "text-muted",
				!slot.known && "text-muted",
			)}
		>
			{team ? (
				<TeamCrest id={team} name={slot.name} className="size-4 shrink-0" />
			) : (
				<span aria-hidden="true" className="size-4 shrink-0" />
			)}
			<span className="min-w-0 flex-1 truncate">{slot.name}</span>
			{slot.bye && (
				<span className="shrink-0 rounded-[3px] border border-line px-1 text-[10px] text-muted uppercase leading-4">
					{t("competition.bracket.bye")}
				</span>
			)}
			<span className="w-4 shrink-0 text-right tabular-nums">
				{score ?? ""}
			</span>
		</span>
	);
}

/** One series: a box with its two teams, the winner in bold. */
export function BracketCard({
	match,
	slots,
	label,
	x,
	y,
	focusable,
	onOpen,
	onFocus,
	onKeyDown,
	...tooltip
}: {
	match: Match;
	slots: [SlotText, SlotText];
	label: string;
	x: number;
	y: number;
	focusable: boolean;
	onOpen: (() => void) | undefined;
	onFocus: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
	/** The `data-tooltip*` props of the Caja tooltip that wraps the card. */
} & Record<`data-${string}`, string | undefined>) {
	const resultOf = (team: string | null) =>
		match.winner === null ? undefined : team === match.winner ? "won" : "lost";
	return (
		<button
			{...tooltip}
			type="button"
			data-match={match.id}
			aria-label={label}
			aria-disabled={onOpen ? undefined : "true"}
			tabIndex={focusable ? 0 : -1}
			onClick={onOpen}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
			className={cn(
				"press absolute flex cursor-pointer flex-col divide-y divide-line overflow-hidden rounded-control border border-line bg-panel py-0 text-left text-text outline-none focus-visible:ring-2 focus-visible:ring-action aria-disabled:cursor-default",
				onOpen && "hover:border-muted hover:bg-surface",
				match.status === "waiting" && "border-dashed",
			)}
		>
			<Row
				team={match.teamA}
				slot={slots[0]}
				score={match.score?.[0]}
				result={resultOf(match.teamA)}
			/>
			<Row
				team={match.teamB}
				slot={slots[1]}
				score={match.score?.[1]}
				result={resultOf(match.teamB)}
			/>
		</button>
	);
}
