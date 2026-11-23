import {
	type ChampionCardView,
	CONTRACT_VERSION,
} from "@rift-legends/contracts";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../../assets/game-role-icon";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { ChampionPortrait } from "../champion-portrait";
import { championLabel, useDraftSession } from "../session";
import { ChampionRelations } from "./champion-relations";

function Profile({ card }: { card: ChampionCardView }) {
	const { t } = useTranslation();
	return (
		<div className="px-3.5 pb-3">
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<dt className="text-muted">{t("draft.card.damage")}</dt>
				<dd>{t(`draft.card.damage.${card.damage}`)}</dd>
				<dt className="text-muted">{t("draft.card.power")}</dt>
				<dd>{t(`draft.card.power.${card.power}`)}</dd>
				<dt className="text-muted">{t("draft.card.archetypes")}</dt>
				<dd>
					{card.archetypes
						.map((a) => t(`draft.card.archetype.${a}`))
						.join(", ")}
				</dd>
			</dl>
			<dl className="mt-3 grid grid-cols-3 divide-x divide-line border-y border-line py-1.5 text-center">
				{(["cc", "mobility", "frontline"] as const).map((stat) => (
					<div key={stat}>
						<dt className="text-xs text-muted">{t(`draft.card.${stat}`)}</dt>
						<dd className="font-semibold text-[17px] tabular-nums">
							{card[stat]}
							<span className="text-xs font-normal text-muted">/10</span>
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

export function ChampionCard({
	id,
	left,
	large = false,
	onClose,
}: {
	id: string;
	left?: boolean;
	large?: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const { sessionId, options, view, mine, content } = useDraftSession();
	const card = useCoreQuery<ChampionCardView | null>(
		{
			v: CONTRACT_VERSION,
			kind: "draft.champion",
			sessionId,
			params: { champion: id, ...(!view && { content }) },
		},
		{ affectedBy: () => false },
	);
	const panel = useRef<HTMLElement>(null);
	useEffect(() => {
		panel.current?.focus({ preventScroll: true });
	}, []);
	const nameOf = (champion: string) => championLabel(options, champion);
	const name = nameOf(id);
	const own = view?.blue.team === mine ? view?.blue : view?.red;
	const enemy = view?.blue.team === mine ? view?.red : view?.blue;
	const unavailable = view?.availability.some(
		(entry) => entry.champion === id && entry.status !== "free",
	);
	return (
		<section
			data-champion-card=""
			ref={panel}
			tabIndex={-1}
			aria-label={t("draft.card.name", { name })}
			className={`flex flex-col overflow-hidden rounded-control border border-line border-t-[3px] border-t-action bg-panel leading-snug shadow-2xl focus-visible:outline-action ${large ? "h-full text-sm" : `absolute inset-y-0 z-20 w-[calc((100%-24px)/4)] text-[13px] ${left ? "left-0" : "right-0"}`}`}
		>
			<header className="flex shrink-0 items-start gap-2 border-b border-line bg-surface px-3 py-2.5">
				<div
					className={
						large
							? "size-20 shrink-0"
							: "flex shrink-0 [&>span]:size-11 [&>span]:text-base"
					}
				>
					<ChampionPortrait
						id={id}
						size={large ? "tile" : "ban"}
						unavailable={!!unavailable}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-wider text-action">
						{t("draft.card.title")}
					</p>
					<h3
						className={`break-words font-display font-bold leading-tight tracking-heading ${large ? "text-3xl" : "text-[18px]"}`}
					>
						{name}
					</h3>
				</div>
				<button
					type="button"
					aria-label={t("draft.card.close")}
					onClick={onClose}
					className="grid size-7 shrink-0 place-items-center rounded-control text-muted hover:bg-panel hover:text-action"
				>
					<X size={16} aria-hidden />
				</button>
			</header>
			<div
				className="min-h-0 overflow-y-auto overscroll-contain"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the card's body scrolls by keyboard.
				tabIndex={0}
			>
				{card.data ? (
					<>
						<ul className="flex flex-wrap gap-1.5 px-3.5 py-3">
							{card.data.positions.map(({ role, tier }) => (
								<li
									key={role}
									className="inline-flex items-center gap-1.5 border border-line px-1.5 py-0.5 text-xs"
								>
									<GameRoleIcon role={role} size={16} />
									<span>{t(`market.role.${role}`)}</span>
									<strong className="text-action">
										{t("draft.card.tier", { tier })}
									</strong>
								</li>
							))}
						</ul>
						<Profile card={card.data} />
						<div
							className={
								large ? "grid grid-cols-3 divide-x divide-line" : "contents"
							}
						>
							<ChampionRelations
								card={card.data}
								showGame={!large || !!view}
								nameOf={nameOf}
								allies={own?.picks ?? []}
								enemies={enemy?.picks ?? []}
							/>
						</div>
					</>
				) : card.error ? (
					<CoreErrorMessage error={card.error} />
				) : (
					<p className="p-3 text-muted">
						{t(card.isPending ? "draft.loading" : "draft.card.unavailable")}
					</p>
				)}
			</div>
		</section>
	);
}
