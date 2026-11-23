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
	onClose,
}: {
	id: string;
	left: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const { sessionId, options, view, mine } = useDraftSession();
	const card = useCoreQuery<ChampionCardView | null>(
		{
			v: CONTRACT_VERSION,
			kind: "draft.champion",
			sessionId,
			params: { champion: id },
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
			className={`absolute inset-y-0 z-20 flex w-[calc((100%-24px)/4)] flex-col overflow-hidden rounded-control border border-line border-t-[3px] border-t-action bg-panel text-[13px] leading-snug shadow-2xl focus-visible:outline-action ${left ? "left-0" : "right-0"}`}
		>
			<header className="flex shrink-0 items-start gap-2 border-b border-line bg-surface px-3 py-2.5">
				<div className="flex shrink-0 [&>span]:size-11 [&>span]:text-base">
					<ChampionPortrait id={id} size="ban" unavailable={!!unavailable} />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-wider text-action">
						{t("draft.card.title")}
					</p>
					<h3 className="break-words font-display font-bold text-[18px] leading-tight tracking-heading">
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
						<ChampionRelations
							card={card.data}
							nameOf={nameOf}
							allies={own?.picks ?? []}
							enemies={enemy?.picks ?? []}
						/>
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
