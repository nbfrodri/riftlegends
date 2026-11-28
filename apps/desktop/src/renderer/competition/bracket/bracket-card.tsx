import type { BracketView } from "@rift-legends/contracts";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { LeagueLogo } from "../../assets/league-logo";
import { TeamCrest } from "../../draft/team-crest";
import { resultStyle } from "../series-result";
import { CARD_H, CARD_W } from "./bracket-layout";

type Match = BracketView["matches"][number];
type Slot = Match["from"][number];

/** A team's full name and, when the content has it, its short one (HLE, T1). */
export interface TeamNames {
	name: string;
	short?: string | undefined;
	league?: string | undefined;
}

export interface SlotText {
	/** The team, or where it will come from while it is not known, in full. */
	name: string;
	/** What the card shows: the short name, or the short origin («Winner SF1»). */
	label: string;
	known: boolean;
	/** A top seed that skipped the first round. */
	bye: boolean;
	draw?: { tier: number; league: string | undefined };
}

/** The two slots of a series, in the order of `teamA` and `teamB`. */
export function slotTexts(
	match: Match,
	team: (id: string) => TeamNames,
	origin: (slot: Slot, short: boolean) => string,
	tiers: ReadonlyMap<string, number> | undefined,
): [SlotText, SlotText] {
	const text = (id: string | null, slot: Slot): SlotText => {
		const entry = id ? team(id) : undefined;
		const tier = id ? tiers?.get(id) : undefined;
		return {
			name: entry?.name ?? origin(slot, false),
			label: entry?.short ?? entry?.name ?? origin(slot, true),
			known: team !== null,
			bye: slot.kind === "seed" && match.side === "upper" && match.round > 1,
			...(tier !== undefined && { draw: { tier, league: entry?.league } }),
		};
	};
	return [text(match.teamA, match.from[0]), text(match.teamB, match.from[1])];
}

/** One team of a series card: logo, name, score; the winner marked. */
export function TeamRow({
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
	const style = resultStyle(result);
	return (
		<span
			data-result={result}
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2 px-2.5 text-[13px]",
				style.row,
				!slot.known && "text-muted",
			)}
		>
			{team ? (
				<TeamCrest id={team} name={slot.name} className="size-4 shrink-0" />
			) : (
				<span aria-hidden="true" className="size-4 shrink-0" />
			)}
			<span className="min-w-0 flex-1 truncate">{slot.label}</span>
			{slot.bye && (
				<span className="shrink-0 rounded-[3px] border border-line px-1 text-[10px] text-muted uppercase leading-4">
					{t("competition.bracket.bye")}
				</span>
			)}
			{slot.draw && (
				<span
					aria-hidden="true"
					className="grid w-9 shrink-0 grid-cols-[1fr_14px] items-center gap-1 text-right font-normal text-[11px] text-muted tabular-nums"
				>
					<span>
						{t("competition.draw.tierShort", { tier: slot.draw.tier })}
					</span>
					{slot.draw.league && (
						<LeagueLogo
							id={slot.draw.league}
							name={slot.draw.league}
							className="size-3.5"
						/>
					)}
				</span>
			)}
			<span
				data-score
				className={cn("w-4 shrink-0 text-right tabular-nums", style.score)}
			>
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
			<TeamRow
				team={match.teamA}
				slot={slots[0]}
				score={match.score?.[0]}
				result={resultOf(match.teamA)}
			/>
			<TeamRow
				team={match.teamB}
				slot={slots[1]}
				score={match.score?.[1]}
				result={resultOf(match.teamB)}
			/>
		</button>
	);
}
