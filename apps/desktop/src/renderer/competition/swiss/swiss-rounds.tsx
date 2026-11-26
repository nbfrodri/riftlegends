import type { StandingsView } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { type KeyboardEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../../draft/team-crest";
import { type TeamNames, TeamRow } from "../bracket/bracket-card";

// A Swiss stage in columns by balance, as the Worlds broadcast shows it (plan
// 31, U7 and U11, #487): one column per round with its series pooled by the
// record their teams brought (0-0, then 1-0 and 0-1…), and at the end who
// qualified and who was eliminated.

type Swiss = NonNullable<StandingsView["swiss"]>;
type Series = Swiss["rounds"][number]["series"][number];

interface Card {
	key: string;
	series: Series;
	label: string;
}

const STEP = { ArrowUp: -1, ArrowDown: 1 } as const;
const SIDE = { ArrowLeft: -1, ArrowRight: 1 } as const;

/** Pools of a round, the best balance first: 2-0, 1-1, 0-2. */
function pools(series: readonly Series[]) {
	const byRecord = new Map<string, Series[]>();
	for (const one of [...series].sort(
		(a, b) => b.record[0] - a.record[0] || a.record[1] - b.record[1],
	)) {
		const key = one.record.join("-");
		byRecord.set(key, [...(byRecord.get(key) ?? []), one]);
	}
	return [...byRecord.values()];
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
	const container = useRef<HTMLDivElement>(null);
	const record = ([wins, losses]: readonly [number, number]) =>
		t("competition.record", { wins, losses });
	const columns = swiss.rounds.map(({ round, relaxed, series }) => {
		const name = t("competition.bracket.round.round", { n: round });
		const grouped = pools(series).map((pool) => {
			const balance = record(pool[0]?.record ?? [0, 0]);
			const where = t("competition.swiss.pool", { round: name, balance });
			return {
				balance,
				cards: pool.map((one, index): Card => {
					const [a, b] = one.teams.map((id) => team(id).name);
					return {
						key: `${round}-${balance}-${index}`,
						series: one,
						label: one.score
							? t("competition.bracket.result", {
									round: where,
									a,
									b,
									scoreA: one.score[0],
									scoreB: one.score[1],
								})
							: t("competition.bracket.versus", { round: where, a, b }),
					};
				}),
			};
		});
		return { round, name, relaxed, pools: grouped };
	});
	const order = columns.map((column) =>
		column.pools.flatMap((pool) => pool.cards.map((card) => card.key)),
	);
	const [focused, setFocused] = useState<string>();
	const active = order.flat().includes(focused ?? "") ? focused : order[0]?.[0];

	const move = (key: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
		const column = order.findIndex((keys) => keys.includes(key));
		const row = order[column]?.indexOf(key) ?? 0;
		let next: string | undefined;
		if (event.key in STEP) {
			const keys = order[column] ?? [];
			next =
				keys[
					Math.min(
						keys.length - 1,
						Math.max(0, row + STEP[event.key as keyof typeof STEP]),
					)
				];
		} else if (event.key in SIDE) {
			const keys =
				order[column + SIDE[event.key as keyof typeof SIDE]] ??
				order[column] ??
				[];
			next = keys[Math.min(row, keys.length - 1)];
		} else return;
		event.preventDefault();
		container.current
			?.querySelector<HTMLElement>(`[data-swiss="${next}"]`)
			?.focus();
	};

	const standing = (status: "qualified" | "eliminated") =>
		swiss.teams
			.filter((row) => row.status === status)
			.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls, not a stage.
		<div
			role="group"
			aria-label={t("competition.swiss.label")}
			ref={container}
			className="min-h-0 max-w-full flex-1 overflow-auto"
		>
			<div className="grid min-w-max auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-x-4">
				{columns.map((column) => (
					<section
						key={column.round}
						aria-label={column.name}
						className="flex flex-col gap-2"
					>
						<h3 className="font-semibold text-[11px] text-text uppercase leading-[28px] tracking-heading">
							{column.name}
						</h3>
						{column.relaxed.map((rule) => (
							<p key={rule} className="text-[11px] text-muted leading-tight">
								{t(`competition.swiss.relaxed.${rule}`)}
							</p>
						))}
						{column.pools.map((pool) => (
							// biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls, not a pool of series.
							<div
								key={pool.balance}
								role="group"
								aria-label={pool.balance}
								className="flex flex-col gap-1.5"
							>
								<span
									aria-hidden="true"
									className="text-[11px] text-muted tabular-nums"
								>
									{pool.balance}
								</span>
								{pool.cards.map((card) => (
									<Tooltip key={card.key} content={card.label}>
										<SwissCard
											card={card}
											team={team}
											focusable={card.key === active}
											onOpen={
												card.series.series && onOpenSeries
													? () => onOpenSeries(card.series.series as string)
													: undefined
											}
											onFocus={() => setFocused(card.key)}
											onKeyDown={move(card.key)}
										/>
									</Tooltip>
								))}
							</div>
						))}
					</section>
				))}
				<div className="flex flex-col gap-4">
					{(["qualified", "eliminated"] as const).map((status) => (
						<section
							key={status}
							aria-label={t(`competition.swiss.${status}`)}
							className="flex flex-col gap-1.5"
						>
							<h3 className="font-semibold text-[11px] text-text uppercase leading-[28px] tracking-heading">
								{t(`competition.swiss.${status}`)}
							</h3>
							{standing(status).length === 0 ? (
								<p className="text-[13px] text-muted">
									{t("competition.swiss.none")}
								</p>
							) : (
								<ul className="flex flex-col gap-1.5">
									{standing(status).map((row) => (
										<li
											key={row.team}
											className={cn(
												"flex h-7 items-center gap-2 rounded-control border border-line bg-panel px-2.5 text-[13px]",
												status === "qualified" ? "text-text" : "text-muted",
											)}
										>
											<TeamCrest
												id={row.team}
												name={team(row.team).name}
												className="size-4 shrink-0"
											/>
											<span className="min-w-0 flex-1 truncate">
												{team(row.team).name}
											</span>
											<span className="shrink-0 tabular-nums">
												{record([row.wins, row.losses])}
											</span>
										</li>
									))}
								</ul>
							)}
						</section>
					))}
				</div>
			</div>
		</div>
	);
}

/** One series: a box with its two teams, the winner in bold. */
function SwissCard({
	card,
	team,
	focusable,
	onOpen,
	onFocus,
	onKeyDown,
	...tooltip
}: {
	card: Card;
	team: (id: string) => TeamNames;
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
			className={cn(
				"press flex h-[52px] w-full cursor-pointer flex-col divide-y divide-line overflow-hidden rounded-control border border-line bg-panel text-left text-text outline-none focus-visible:ring-2 focus-visible:ring-action aria-disabled:cursor-default",
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
