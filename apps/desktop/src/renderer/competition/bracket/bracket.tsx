import type { BracketView } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { pacing } from "../../draft/broadcast/pacing";
import { TeamCrest } from "../../draft/team-crest";
import { BracketCard, slotTexts, type TeamNames } from "./bracket-card";
import { bracketLabels, type Label } from "./bracket-labels";
import {
	CARD_H,
	CARD_W,
	HEADER_H,
	layoutBracket,
	neighbour,
} from "./bracket-layout";

// Single and double elimination bracket of a competition stage (plan 31, U6
// and U11). Fed by `competition.bracket`; the route decides what opening a
// series does.

type Match = BracketView["matches"][number];
type Slot = Match["from"][number];

const KEYS = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
} as const;

const DRAW = { animationDuration: `${pacing.bracketDrawMs}ms` };

/** Connectors whose feeding series has just been played: only those are drawn in. */
function useFreshConnectors(done: readonly string[]) {
	const reduced = useReducedMotion();
	const seen = useRef<Set<string> | null>(null);
	const fresh =
		reduced || seen.current === null
			? new Set<string>()
			: new Set(done.filter((id) => !seen.current?.has(id)));
	useEffect(() => {
		seen.current = new Set(done);
	}, [done]);
	return fresh;
}

export function Bracket({
	bracket,
	team,
	onOpenSeries,
}: {
	bracket: BracketView;
	/** Names of a team; the card shows the short one and the tooltip the full one. */
	team: (id: string) => TeamNames;
	/** Opens a played series by its `competition.schedule` id. */
	onOpenSeries?: (series: string) => void;
}) {
	const { t } = useTranslation();
	const layout = useMemo(() => layoutBracket(bracket), [bracket]);
	const labels = useMemo(() => bracketLabels(bracket.matches), [bracket]);
	const done = useMemo(
		() => layout.connectors.filter((c) => c.done).map((c) => c.id),
		[layout],
	);
	const fresh = useFreshConnectors(done);
	const [focused, setFocused] = useState<string>();
	const container = useRef<HTMLDivElement>(null);
	const active =
		layout.placed.find((p) => p.match.id === focused)?.match.id ??
		layout.placed[0]?.match.id;

	const text = (label: Label | undefined) =>
		label ? t(label.key, label.params) : "";
	const nameOf = (id: string) => {
		const label = labels.get(id);
		if (!label) return id;
		const round = text(label.round);
		return label.index === null
			? round
			: t("competition.bracket.numbered", { round, n: label.index });
	};
	const origin = (slot: Slot, short: boolean) => {
		if (slot.kind === "seed")
			return t("competition.bracket.seed", { n: slot.rank });
		return short
			? t(`competition.bracket.${slot.kind}Short`, {
					match: labels.get(slot.match)?.code ?? slot.match,
				})
			: t(`competition.bracket.${slot.kind}Of`, { match: nameOf(slot.match) });
	};

	const move = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
		const direction = KEYS[event.key as keyof typeof KEYS];
		if (!direction) return;
		event.preventDefault();
		const next = neighbour(layout.placed, id, direction);
		if (next)
			container.current
				?.querySelector<HTMLElement>(`[data-match="${next}"]`)
				?.focus();
	};

	const champion = bracket.champion;
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls, not a bracket.
		<div
			role="group"
			aria-label={t("competition.bracket.label")}
			className="max-w-full overflow-auto"
		>
			<div
				ref={container}
				className="relative"
				style={{ width: layout.width, height: layout.height }}
			>
				<svg
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 fill-none"
					width={layout.width}
					height={layout.height}
				>
					{layout.connectors.map((c) => (
						<path
							key={c.id}
							d={c.d}
							pathLength={1}
							data-connector={c.id}
							data-done={c.done}
							style={fresh.has(c.id) ? DRAW : undefined}
							className={cn(
								"stroke-[1.5]",
								c.done ? "stroke-muted" : "stroke-line",
								fresh.has(c.id) && "bracket-draw",
							)}
						/>
					))}
				</svg>
				{layout.headers.map(({ match, x, y }) => (
					<span
						key={`${match.side}-${match.round}`}
						aria-hidden="true"
						style={{ left: x, top: y, width: CARD_W, height: HEADER_H }}
						className="absolute truncate font-semibold text-[11px] text-muted uppercase tracking-heading"
					>
						{t("competition.bracket.header", {
							round: text(labels.get(match.id)?.round),
							n: match.bestOf,
						})}
					</span>
				))}
				{layout.placed.map(({ match, x, y }) => {
					const slots = slotTexts(match, team, origin);
					const [a, b] = slots.map((slot) => slot.name);
					const round = nameOf(match.id);
					const label = match.score
						? t("competition.bracket.result", {
								round,
								a,
								b,
								scoreA: match.score[0],
								scoreB: match.score[1],
							})
						: t("competition.bracket.versus", { round, a, b });
					const series = match.series;
					return (
						<Tooltip key={match.id} content={label}>
							<BracketCard
								match={match}
								slots={slots}
								label={label}
								x={x}
								y={y}
								focusable={match.id === active}
								onOpen={
									series && onOpenSeries
										? () => onOpenSeries(series)
										: undefined
								}
								onFocus={() => setFocused(match.id)}
								onKeyDown={move(match.id)}
							/>
						</Tooltip>
					);
				})}
				{champion && layout.champion && (
					<div
						role="status"
						style={{
							left: layout.champion.x,
							top: layout.champion.y - HEADER_H,
							width: CARD_W,
						}}
						className="absolute flex flex-col"
					>
						<span className="font-semibold text-[11px] text-action uppercase tracking-heading leading-[28px]">
							{t("competition.bracket.champion")}
						</span>
						<span
							className="flex items-center gap-2 rounded-control border-2 border-action bg-panel px-2.5 font-semibold text-text"
							style={{ height: CARD_H }}
						>
							<TeamCrest
								id={champion}
								name={team(champion).name}
								className="size-7 shrink-0"
							/>
							<span className="min-w-0 truncate">{team(champion).name}</span>
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
