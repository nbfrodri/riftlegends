import type { StandingsView } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import {
	type KeyboardEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import { type TeamNames, TeamRow } from "../bracket/bracket-card";
import {
	CARD_H,
	COL_GAP,
	cardTop,
	layoutSwiss,
	NOTE_H,
	type PlacedBox,
	POOL_HEAD,
	ROUND_HEAD,
	ROW_H,
	rowTop,
	type SwissSeries,
} from "./swiss-layout";

// A Swiss stage in columns by balance, as the Worlds broadcast shows it (plan
// 31, U7 and U11, #487): one column per round with its series pooled by the
// record their teams brought (0-0, then 1-0 and 0-1…), winners climbing and
// losers sinking, thin lines showing where each balance leads; the teams a
// round qualifies open the next column on top and the ones it eliminates
// close it at the bottom.

type Swiss = NonNullable<StandingsView["swiss"]>;

interface Card {
	key: string;
	round: number;
	series: SwissSeries;
	label: string;
	/** Centre of the card, to move sideways to the nearest one. */
	y: number;
}

const STEP = { ArrowUp: -1, ArrowDown: 1 } as const;
const SIDE = { ArrowLeft: -1, ArrowRight: 1 } as const;

/** Columns share the width they have, within readable bounds. */
function useColumnWidth(columns: number) {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		setWidth(element.clientWidth);
		return () => observer.disconnect();
	}, []);
	const fit = Math.floor((width - (columns - 1) * COL_GAP) / columns);
	return { ref, column: width ? Math.min(200, Math.max(136, fit)) : 160 };
}

export function SwissRounds({
	swiss,
	team,
	onOpenSeries,
}: {
	swiss: Swiss;
	team: (id: string) => TeamNames;
	/** Opens a played series by its `competition.schedule` id. */
	onOpenSeries?: ((series: string) => void) | undefined;
}) {
	const { t } = useTranslation();
	const rounds = Math.max(swiss.totalRounds, swiss.rounds.length);
	const { ref, column } = useColumnWidth(rounds + 1);
	const layout = useMemo(() => layoutSwiss(swiss, column), [swiss, column]);
	const record = (wins: number, losses: number) =>
		t("competition.record", { wins, losses });
	const roundName = (round: number) =>
		t("competition.bracket.round.round", { n: round });

	const roundColumns = layout.columns.filter(
		(column): column is typeof column & { round: number } =>
			column.round !== null,
	);
	const cards = roundColumns.map(({ round, pools }) =>
		pools.flatMap((pool) =>
			(pool.series ?? []).map((series, index): Card => {
				const where = t("competition.swiss.pool", {
					round: roundName(round),
					balance: record(pool.wins, pool.losses),
				});
				const [a, b] = series.teams.map((id) => team(id).name);
				return {
					key: `${pool.id}-${index}`,
					round,
					series,
					y: pool.y + cardTop(index) + CARD_H / 2,
					label: series.score
						? t("competition.bracket.result", {
								round: where,
								a,
								b,
								scoreA: series.score[0],
								scoreB: series.score[1],
							})
						: t("competition.bracket.versus", { round: where, a, b }),
				};
			}),
		),
	);
	const all = cards.flat();
	const [focused, setFocused] = useState<string>();
	const active = all.some(({ key }) => key === focused) ? focused : all[0]?.key;

	const move = (card: Card) => (event: KeyboardEvent<HTMLButtonElement>) => {
		const column = card.round - 1;
		const own = cards[column] ?? [];
		let next: Card | undefined;
		if (event.key in STEP) {
			const index = own.indexOf(card) + STEP[event.key as keyof typeof STEP];
			next = own[Math.min(own.length - 1, Math.max(0, index))];
		} else if (event.key in SIDE) {
			const step = SIDE[event.key as keyof typeof SIDE];
			// The nearest round with series that way; none: stay.
			let target = column + step;
			while (cards[target] && cards[target]?.length === 0) target += step;
			const candidates = cards[target] ?? [];
			next =
				candidates.reduce<Card | undefined>(
					(best, other) =>
						!best || Math.abs(other.y - card.y) < Math.abs(best.y - card.y)
							? other
							: best,
					undefined,
				) ?? card;
		} else return;
		event.preventDefault();
		ref.current
			?.querySelector<HTMLElement>(`[data-swiss="${next?.key}"]`)
			?.focus();
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls, not a stage.
		<div
			role="group"
			aria-label={t("competition.swiss.label")}
			ref={ref}
			className="min-h-0 max-w-full flex-1 overflow-auto"
		>
			<div
				className="relative"
				style={{ width: layout.width, height: layout.height }}
			>
				<svg
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 fill-none"
					width={layout.width}
					height={layout.height}
				>
					{layout.flows.map((flow) => (
						<path
							key={flow.id}
							d={flow.d}
							data-flow={flow.id}
							data-result={flow.result}
							strokeDasharray={flow.result === "loss" ? "4 3" : undefined}
							className={cn(
								"stroke-[1.25]",
								flow.result === "win" ? "stroke-muted/70" : "stroke-line",
							)}
						/>
					))}
				</svg>
				{roundColumns.map((placed, index) => (
					<section
						key={placed.round}
						aria-label={roundName(placed.round)}
						className="absolute top-0"
						style={{ left: placed.x, width: column, height: layout.height }}
					>
						<h3
							className="font-semibold text-[11px] text-text uppercase tracking-heading"
							style={{ lineHeight: `${ROUND_HEAD}px` }}
						>
							{roundName(placed.round)}
						</h3>
						{placed.relaxed.length > 0 && (
							<div
								className="absolute flex flex-col text-[11px] text-muted leading-tight"
								style={{ top: ROUND_HEAD, height: NOTE_H }}
							>
								{placed.relaxed.map((rule) => (
									<p key={rule}>{t(`competition.swiss.relaxed.${rule}`)}</p>
								))}
							</div>
						)}
						{placed.pools.map((pool) => (
							// biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls, not a pool of series.
							<div
								key={pool.id}
								role="group"
								aria-label={record(pool.wins, pool.losses)}
								className="absolute inset-x-0"
								style={{ top: pool.y, height: pool.height }}
							>
								<span
									aria-hidden="true"
									className="block font-semibold text-[12px] text-muted tabular-nums"
									style={{ lineHeight: `${POOL_HEAD}px` }}
								>
									{record(pool.wins, pool.losses)}
								</span>
								{pool.series ? (
									(cards[index] ?? [])
										.filter((card) => card.key.startsWith(`${pool.id}-`))
										.map((card, at) => (
											<Tooltip key={card.key} content={card.label}>
												<SwissCard
													card={card}
													team={team}
													top={cardTop(at)}
													focusable={card.key === active}
													onOpen={
														card.series.series && onOpenSeries
															? () => onOpenSeries(card.series.series as string)
															: undefined
													}
													onFocus={() => setFocused(card.key)}
													onKeyDown={move(card)}
												/>
											</Tooltip>
										))
								) : (
									<p
										className="absolute inset-x-0 flex items-center justify-center rounded-control border border-line border-dashed text-[12px] text-muted"
										style={{ top: POOL_HEAD, height: CARD_H }}
									>
										{t("competition.swiss.toPair")}
									</p>
								)}
							</div>
						))}
					</section>
				))}
				{layout.columns.flatMap((placed) =>
					placed.boxes.map((box) => (
						<OutcomeBox
							key={box.id}
							box={box}
							x={placed.x}
							width={column}
							team={team}
							record={record(box.wins, box.losses)}
						/>
					)),
				)}
			</div>
		</div>
	);
}

/**
 * The teams a round qualified (on top of the next column) or eliminated (at
 * its bottom), under their record. The state is the title and the place.
 */
function OutcomeBox({
	box,
	x,
	width,
	team,
	record,
}: {
	box: PlacedBox;
	x: number;
	width: number;
	team: (id: string) => TeamNames;
	record: string;
}) {
	const { t } = useTranslation();
	const qualified = box.outcome === "qualified";
	return (
		<section
			aria-label={t(
				qualified
					? "competition.swiss.qualifiedAt"
					: "competition.swiss.eliminatedAt",
				{ record },
			)}
			className="absolute"
			style={{ left: x, top: box.y, width, height: box.height }}
		>
			<h3
				className={cn(
					"flex items-baseline justify-between font-semibold text-[11px] uppercase tracking-heading",
					qualified ? "text-text" : "text-muted",
				)}
				style={{ lineHeight: `${POOL_HEAD}px` }}
			>
				<span>{t(`competition.swiss.${box.outcome}`)}</span>
				<span className="text-[12px] tabular-nums tracking-normal">
					{record}
				</span>
			</h3>
			{box.teams.length === 0 ? (
				<p
					className="absolute inset-x-0 flex items-center justify-center rounded-control border border-line border-dashed text-[12px] text-muted"
					style={{ top: POOL_HEAD, height: ROW_H }}
				>
					{t("competition.swiss.toDecide")}
				</p>
			) : (
				<ul>
					{box.teams.map((id, index) => (
						<li
							key={id}
							className={cn(
								"absolute inset-x-0 flex items-center gap-2 rounded-control border px-2.5 text-[13px]",
								qualified
									? "border-line bg-panel font-semibold text-text"
									: "border-line/60 text-muted",
							)}
							style={{ top: rowTop(index), height: ROW_H }}
						>
							<TeamCrest
								id={id}
								name={team(id).name}
								className="size-4 shrink-0"
							/>
							<span className="min-w-0 flex-1 truncate">
								{team(id).short ? (
									<>
										<span aria-hidden="true">{team(id).short}</span>
										<span className="sr-only">{team(id).name}</span>
									</>
								) : (
									team(id).name
								)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/** One series: a box with its two teams, the winner in bold. */
function SwissCard({
	card,
	team,
	top,
	focusable,
	onOpen,
	onFocus,
	onKeyDown,
	...tooltip
}: {
	card: Card;
	team: (id: string) => TeamNames;
	top: number;
	focusable: boolean;
	onOpen: (() => void) | undefined;
	onFocus: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
	/** The `data-tooltip*` props of the Caja tooltip that wraps the card. */
} & Record<`data-${string}`, string | undefined>) {
	const { series } = card;
	return (
		<button
			{...tooltip}
			type="button"
			data-swiss={card.key}
			aria-label={card.label}
			aria-disabled={onOpen ? undefined : "true"}
			tabIndex={focusable ? 0 : -1}
			onClick={onOpen}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			style={{ top, height: CARD_H }}
			className={cn(
				"press absolute inset-x-0 flex cursor-pointer flex-col divide-y divide-line overflow-hidden rounded-control border border-line bg-panel text-left text-text outline-none focus-visible:ring-2 focus-visible:ring-action aria-disabled:cursor-default",
				onOpen && "hover:border-muted hover:bg-surface",
			)}
		>
			{series.teams.map((id, index) => (
				<TeamRow
					key={id}
					team={id}
					slot={{
						name: team(id).name,
						label: team(id).short ?? team(id).name,
						known: true,
						bye: false,
					}}
					score={series.score?.[index]}
					result={
						series.winner === undefined
							? undefined
							: series.winner === id
								? "won"
								: "lost"
					}
				/>
			))}
		</button>
	);
}
