import type { Role } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { LayoutGrid, MouseRight } from "lucide-react";
import { type KeyboardEvent, memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { ChampionPortrait } from "../champion-portrait";
import { ChampionCardHelp, ChampionCardHint } from "./champion-card-hint";

/** Why a champion cannot be chosen; `null` when it is free. */
type Unavailable = "banned" | "picked" | "fearless" | null;

export interface PoolChampion {
	id: string;
	name: string;
	roles: readonly Role[];
	unavailable: Unavailable;
}

const COLUMNS = 6;
const ROLE_FILTER = ["all", "top", "jungle", "mid", "bot", "support"] as const;
type RoleFilter = (typeof ROLE_FILTER)[number];

const NEXT: Record<string, number> = {
	ArrowRight: 1,
	ArrowLeft: -1,
	ArrowDown: COLUMNS,
	ArrowUp: -COLUMNS,
};

const Tile = memo(function Tile(props: {
	id: string;
	name: string;
	unavailable: Unavailable;
	index: number;
	selected: boolean;
	tabbable: boolean;
	onSelect: (id: string) => void;
}) {
	const { t } = useTranslation();
	const { id, name, unavailable } = props;
	const reason = unavailable ? t(`draft.board.status.${unavailable}`) : null;
	return (
		<Tooltip
			heading={reason ? name : undefined}
			content={reason ?? name}
			side="left"
		>
			<button
				type="button"
				data-index={props.index}
				data-card-champion={id}
				aria-keyshortcuts="I"
				tabIndex={props.tabbable ? 0 : -1}
				aria-pressed={props.selected}
				aria-disabled={unavailable ? true : undefined}
				aria-label={reason ? `${name}. ${reason}` : name}
				onClick={() => !unavailable && props.onSelect(id)}
				className={`group relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-control bg-surface outline-offset-[-3px] focus-visible:z-1 focus-visible:outline-3 focus-visible:outline-action ${unavailable ? "cursor-default" : "hover:brightness-110"}`}
			>
				<ChampionPortrait
					id={id}
					size="pool"
					unavailable={unavailable !== null}
				/>
				<MouseRight
					data-slot="card-hint"
					aria-hidden
					className="pointer-events-none absolute right-1 top-1 hidden size-5 rounded-control bg-panel/85 p-0.5 text-action group-hover:block group-focus-visible:block"
				/>
				{props.selected && (
					// Tint plus an inset frame: unlike hover (brighter) and focus (outline).
					<span
						data-slot="selection"
						aria-hidden
						className="pointer-events-none absolute inset-0 rounded-control bg-action/20 ring-2 ring-action ring-inset"
					/>
				)}
			</button>
		</Tooltip>
	);
});

const RoleFilterButtons = memo(function RoleFilterButtons(props: {
	value: RoleFilter;
	onChange: (value: RoleFilter) => void;
}) {
	const { t } = useTranslation();
	return (
		<fieldset
			aria-label={t("draft.board.roleFilter")}
			className="m-0 flex shrink-0 gap-1 border-0 p-0"
		>
			{ROLE_FILTER.map((value) => {
				const label =
					value === "all"
						? t("draft.board.allRoles")
						: t(`market.role.${value}`);
				return (
					<Tooltip key={value} content={label}>
						<button
							type="button"
							aria-pressed={props.value === value}
							aria-label={label}
							onClick={() => props.onChange(value)}
							className="grid size-[30px] place-items-center rounded-control border border-line bg-surface text-muted outline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-action aria-pressed:border-action aria-pressed:bg-action/15 aria-pressed:text-text"
						>
							{value === "all" ? (
								<LayoutGrid size={16} aria-hidden />
							) : (
								<GameRoleIcon role={value} size={16} />
							)}
						</button>
					</Tooltip>
				);
			})}
		</fieldset>
	);
});

/**
 * The champion pool: role filter, search and a dense grid (about 24 visible,
 * the rest scrolls). Arrows move through the grid and Enter selects. Memoised:
 * confirming re-renders only the tiles that change.
 */
export const ChampionPool = memo(function ChampionPool(props: {
	champions: readonly PoolChampion[];
	selected: string | null;
	onSelect: (id: string) => void;
}) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [role, setRole] = useState<RoleFilter>("all");
	const [active, setActive] = useState(0);
	const grid = useRef<HTMLFieldSetElement>(null);

	const needle = query.trim().toLowerCase();
	const shown = props.champions.filter(
		(c) =>
			c.name.toLowerCase().includes(needle) &&
			(role === "all" || c.roles.includes(role as Role)),
	);
	const total = props.champions.length;
	const focusable = Math.min(active, Math.max(shown.length - 1, 0));

	const move = (event: KeyboardEvent<HTMLFieldSetElement>) => {
		const step = NEXT[event.key];
		const from = Number(
			(event.target as HTMLElement).dataset.index ?? Number.NaN,
		);
		if (step === undefined || Number.isNaN(from)) return;
		event.preventDefault();
		const to = Math.min(Math.max(from + step, 0), shown.length - 1);
		setActive(to);
		grid.current
			?.querySelector<HTMLButtonElement>(`[data-index="${to}"]`)
			?.focus();
	};

	const chooseRole = useCallback((value: RoleFilter) => {
		setRole(value);
		setActive(0);
	}, []);

	return (
		<>
			<div className="flex items-center justify-between gap-3.5">
				<h2
					id="pool-title"
					className="font-bold font-display text-[21px] tracking-heading"
				>
					{t("draft.board.pool")}
				</h2>
				<ChampionCardHint />
				<span role="status" className="text-[13px] text-muted">
					{shown.length === total
						? t("draft.board.count", { count: total })
						: shown.length === 0
							? t("draft.board.noMatches")
							: t("draft.board.filtered", { shown: shown.length, total })}
				</span>
			</div>
			<div className="my-2 flex items-center gap-2">
				<input
					type="search"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActive(0);
					}}
					aria-label={t("draft.board.search")}
					placeholder={t("draft.board.searchPlaceholder")}
					className="min-w-0 max-w-60 flex-1 rounded-control border border-line bg-surface px-2.5 py-[5px] text-[13px] text-text placeholder:text-muted hover:border-muted focus-visible:border-action"
				/>
				<RoleFilterButtons value={role} onChange={chooseRole} />
			</div>
			<ChampionCardHelp />
			<fieldset
				ref={grid}
				aria-label={t("draft.board.grid")}
				onKeyDown={move}
				onFocus={(event) => {
					const index = Number(event.target.dataset.index);
					if (!Number.isNaN(index)) setActive(index);
				}}
				className="m-0 mb-[9px] grid min-w-0 border-0 p-0 max-h-[calc(4*var(--row)+21px)] grid-cols-6 auto-rows-(--row) gap-[7px] overflow-y-auto [--row:clamp(62px,10.5vh,112px)]"
			>
				{shown.map((champion, index) => (
					<Tile
						key={champion.id}
						id={champion.id}
						name={champion.name}
						unavailable={champion.unavailable}
						index={index}
						selected={champion.id === props.selected}
						tabbable={index === focusable}
						onSelect={props.onSelect}
					/>
				))}
			</fieldset>
		</>
	);
});
