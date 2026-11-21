import type { Role } from "@rift-legends/contracts";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import {
	type CSSProperties,
	type KeyboardEvent,
	memo,
	type ReactNode,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { championName, hue, initials } from "./champions";

/** Why a champion cannot be chosen; `null` when it is free. */
type Unavailable = "banned" | "picked" | "fearless" | null;

export interface PoolChampion {
	id: string;
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

/** A champion of the grid; unavailable ones are grey and struck, with the reason only in their name. */
const Tile = memo(function Tile(props: {
	champion: PoolChampion;
	index: number;
	selected: boolean;
	tabbable: boolean;
	onSelect: (id: string) => void;
}) {
	const { t } = useTranslation();
	const { id, unavailable } = props.champion;
	const name = championName(id);
	const reason = unavailable ? t(`draft.board.status.${unavailable}`) : null;
	return (
		<button
			type="button"
			data-index={props.index}
			tabIndex={props.tabbable ? 0 : -1}
			aria-pressed={props.selected}
			aria-disabled={unavailable ? true : undefined}
			aria-label={reason ? `${name}. ${reason}` : undefined}
			title={reason ?? undefined}
			onClick={() => !unavailable && props.onSelect(id)}
			className={`relative flex min-h-0 flex-col rounded-control bg-surface text-left outline-offset-[-3px] focus-visible:z-1 focus-visible:outline-3 focus-visible:outline-action ${props.selected ? "outline-2 outline-action" : ""} ${unavailable ? "cursor-default" : ""}`}
		>
			<span
				aria-hidden="true"
				style={{ "--h": hue(id) } as CSSProperties}
				className={`relative grid min-h-[18px] w-full flex-1 place-items-center font-bold font-display text-[clamp(19px,3.4vh,31px)] leading-none tracking-[-0.085em] ${
					unavailable
						? "bg-[#303744] text-[#b6beca] after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom_right,transparent_calc(50%-1px),#aab3c2_50%,transparent_calc(50%+1px))]"
						: "bg-[hsl(var(--h)_27%_26%)] bg-[repeating-linear-gradient(126deg,transparent_0_11px,hsl(var(--h)_26%_55%/0.14)_11px_12px,transparent_12px_18px)] text-[hsl(var(--h)_53%_79%)]"
				}`}
			>
				{initials(id)}
			</span>
			<b
				className={`truncate px-1.5 py-1 text-[14px] ${unavailable ? "font-medium text-muted" : ""}`}
			>
				{name}
			</b>
		</button>
	);
});

/**
 * The champion pool: role filter, search and a dense grid (about 24 visible,
 * the rest scrolls). Arrows move through the grid and Enter selects.
 */
export function ChampionPool(props: {
	champions: readonly PoolChampion[];
	selected: string | null;
	onSelect: (id: string) => void;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [role, setRole] = useState<RoleFilter>("all");
	const [active, setActive] = useState(0);
	const grid = useRef<HTMLFieldSetElement>(null);

	const needle = query.trim().toLowerCase();
	const shown = props.champions.filter(
		(c) =>
			c.id.includes(needle) &&
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

	const items = ROLE_FILTER.map((value) => ({
		value,
		label:
			value === "all" ? t("draft.board.allRoles") : t(`market.role.${value}`),
	}));

	return (
		<section
			aria-labelledby="pool-title"
			className="flex min-h-0 min-w-0 flex-col bg-panel px-[15px] pt-[13px]"
		>
			<div className="flex items-center justify-between gap-3.5">
				<h2
					id="pool-title"
					className="font-bold font-display text-[21px] tracking-heading"
				>
					{t("draft.board.pool")}
				</h2>
				<span role="status" className="text-[13px] text-muted">
					{shown.length === total
						? t("draft.board.count", { count: total })
						: shown.length === 0
							? t("draft.board.noMatches")
							: t("draft.board.filtered", { shown: shown.length, total })}
				</span>
			</div>
			<div className="my-2 flex gap-2">
				<input
					type="search"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActive(0);
					}}
					aria-label={t("draft.board.search")}
					placeholder={t("draft.board.searchPlaceholder")}
					className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-[5px] text-[13px] text-text placeholder:text-muted hover:border-muted focus-visible:border-action"
				/>
				<Select
					items={items}
					value={role}
					onValueChange={(value) => {
						if (value) setRole(value as RoleFilter);
						setActive(0);
					}}
				>
					<SelectTrigger
						aria-label={t("draft.board.roleFilter")}
						className="min-w-40 text-[13px]"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<fieldset
				ref={grid}
				aria-label={t("draft.board.grid")}
				onKeyDown={move}
				onFocus={(event) => {
					const index = Number(event.target.dataset.index);
					if (!Number.isNaN(index)) setActive(index);
				}}
				className="m-0 mb-[9px] grid min-w-0 border-0 p-0 max-h-[calc(4*var(--row)+21px)] grid-cols-6 auto-rows-(--row) gap-[7px] overflow-y-auto [--row:clamp(62px,10.5vh,112px)] [scrollbar-color:var(--color-line)_var(--color-panel)] [scrollbar-width:thin]"
			>
				{shown.map((champion, index) => (
					<Tile
						key={champion.id}
						champion={champion}
						index={index}
						selected={champion.id === props.selected}
						tabbable={index === focusable}
						onSelect={props.onSelect}
					/>
				))}
			</fieldset>
			{props.children}
		</section>
	);
}
