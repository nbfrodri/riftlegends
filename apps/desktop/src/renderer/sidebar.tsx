import { Kbd } from "@rift-legends/ui-kit/components/kbd";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	Binoculars,
	CalendarDays,
	Columns2,
	Database,
	Dumbbell,
	History,
	House,
	type LucideIcon,
	Mountain,
	Newspaper,
	PanelLeftClose,
	PanelLeftOpen,
	SlidersHorizontal,
	Swords,
	Trophy,
	Users,
} from "lucide-react";
import { type KeyboardEvent, useId } from "react";
import { useTranslation } from "react-i18next";
import { placeholderToday } from "./placeholder-players";

type SectionPath =
	| "/calendario"
	| "/draft"
	| "/campeones"
	| "/base-de-datos"
	| "/mercado"
	| "/competicion"
	| "/ajustes";

interface Section {
	label:
		| "shell.nav.home"
		| "shell.nav.calendar"
		| "shell.nav.draft"
		| "shell.nav.champions"
		| "shell.nav.database"
		| "shell.nav.roster"
		| "shell.nav.market"
		| "shell.nav.scouting"
		| "shell.nav.training"
		| "shell.nav.competition"
		| "shell.nav.news"
		| "shell.nav.history"
		| "shell.nav.settings";
	icon: LucideIcon;
	/** Sections without a screen yet are shown as "coming soon". */
	to?: SectionPath;
}

const sections: readonly Section[] = [
	{ label: "shell.nav.home", icon: House },
	{ label: "shell.nav.calendar", icon: CalendarDays, to: "/calendario" },
	{ label: "shell.nav.draft", icon: Columns2, to: "/draft" },
	{ label: "shell.nav.champions", icon: Swords, to: "/campeones" },
	{ label: "shell.nav.database", icon: Database, to: "/base-de-datos" },
	{ label: "shell.nav.roster", icon: Users },
	{ label: "shell.nav.market", icon: ArrowLeftRight, to: "/mercado" },
	{ label: "shell.nav.scouting", icon: Binoculars },
	{ label: "shell.nav.training", icon: Dumbbell },
	{ label: "shell.nav.competition", icon: Trophy, to: "/competicion" },
	{ label: "shell.nav.news", icon: Newspaper },
	{ label: "shell.nav.history", icon: History },
	{ label: "shell.nav.settings", icon: SlidersHorizontal, to: "/ajustes" },
];

const keyboardMoves: Record<string, (index: number, count: number) => number> =
	{
		ArrowDown: (index, count) => (index + 1) % count,
		ArrowUp: (index, count) => (index + count - 1) % count,
		Home: () => 0,
		End: (_index, count) => count - 1,
	};

/** Arrow keys, Home and End move the focus between the available sections. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
	const move = keyboardMoves[event.key];
	if (!move) return;
	const available = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>(
			"button:not([aria-disabled='true'])",
		),
	);
	const index = available.indexOf(event.target as HTMLElement);
	if (index < 0) return;
	event.preventDefault();
	available[move(index, available.length)]?.focus();
}

const icon = { "aria-hidden": true, size: 20, strokeWidth: 1.65 } as const;

export function Sidebar({
	expanded,
	onToggle,
	pathname,
}: {
	expanded: boolean;
	onToggle: () => void;
	pathname: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const navId = useId();
	const comingSoonId = useId();
	const comingSoon = t("shell.comingSoon");
	const toggleLabel = t(
		expanded ? "shell.sidebar.collapse" : "shell.sidebar.expand",
	);
	const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;

	return (
		<aside
			aria-label={t("shell.sidebar.label")}
			className={cn(
				"flex shrink-0 flex-col overflow-hidden border-line border-r bg-panel motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-lock",
				expanded ? "w-[196px]" : "w-[58px]",
			)}
		>
			{/* Placeholder club until careers exist (catalog keys `placeholder.*`). */}
			<div className="flex min-h-[84px] shrink-0 items-center gap-2.5 border-line border-b px-3">
				<div
					aria-hidden="true"
					className="grid h-[38px] w-[34px] shrink-0 place-items-center bg-surface text-side-blue [clip-path:polygon(0_0,100%_0,100%_75%,50%_100%,0_75%)]"
				>
					<Mountain size={22} strokeWidth={1.65} />
				</div>
				<div
					className={cn("min-w-0 whitespace-nowrap", !expanded && "sr-only")}
				>
					<strong className="block font-bold font-display text-[18px] tracking-[-0.02em]">
						{t("placeholder.club.name")}
					</strong>
					<time
						dateTime={placeholderToday}
						className="mt-[3px] block text-[12px] text-muted"
					>
						{t("placeholder.club.seasonDate")}
					</time>
				</div>
			</div>

			<nav
				id={navId}
				aria-label={t("shell.nav.label")}
				onKeyDown={moveFocus}
				className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-1.5 pt-2.5 pb-1.5"
			>
				<span id={comingSoonId} hidden>
					{comingSoon}
				</span>
				{sections.map(({ label: key, icon: Icon, to }) => {
					const label = t(key);
					const current =
						to !== undefined &&
						(pathname === to || pathname.startsWith(`${to}/`));
					return (
						<Tooltip
							key={key}
							disabled={expanded}
							side="right"
							heading={to ? undefined : label}
							content={to ? label : comingSoon}
						>
							<button
								type="button"
								aria-label={label}
								aria-current={current ? "page" : undefined}
								aria-disabled={to ? undefined : true}
								aria-describedby={to ? undefined : comingSoonId}
								tabIndex={to ? undefined : -1}
								onClick={to ? () => void navigate({ to }) : undefined}
								className={cn(
									"flex h-[clamp(38px,4.8vh,44px)] shrink-0 items-center gap-[11px] whitespace-nowrap px-3 text-left font-[550]",
									to
										? "press cursor-pointer text-text hover:bg-surface"
										: "cursor-default text-muted",
									current &&
										"bg-surface text-action shadow-[inset_2px_0_var(--color-action)]",
									to === "/ajustes" && "mt-auto",
								)}
							>
								<Icon {...icon} className="shrink-0" />
								{expanded && (
									<span className="min-w-0">
										<span className="block text-[14px] leading-[1.15]">
											{label}
										</span>
										{!to && (
											<span className="mt-0.5 block font-normal text-[11px] leading-[1.15]">
												{comingSoon}
											</span>
										)}
									</span>
								)}
							</button>
						</Tooltip>
					);
				})}
			</nav>

			<Tooltip
				disabled={expanded}
				side="right"
				content={toggleLabel}
				shortcut={t("shell.sidebar.shortcut")}
			>
				<button
					type="button"
					aria-label={toggleLabel}
					aria-controls={navId}
					aria-expanded={expanded}
					aria-keyshortcuts="Alt+B"
					onClick={onToggle}
					className="flex h-11 shrink-0 cursor-pointer items-center gap-[11px] border-line border-t pr-2.5 pl-[18px] text-left text-muted hover:bg-surface"
				>
					<ToggleIcon aria-hidden="true" size={19} strokeWidth={1.65} />
					{expanded && (
						<>
							<span className="min-w-0 font-[550] text-[12px] leading-[1.15]">
								{toggleLabel}
							</span>
							<Kbd className="ml-auto">{t("shell.sidebar.shortcut")}</Kbd>
						</>
					)}
				</button>
			</Tooltip>
		</aside>
	);
}
