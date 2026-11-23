import {
	type ChampionCardView,
	type ChampionRelation,
	ROLES,
} from "@rift-legends/contracts";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

export function Section({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} className="border-t border-line px-3.5 py-3">
			<h4
				id={id}
				className="mb-2 font-bold font-display text-[13px] tracking-heading"
			>
				{title}
			</h4>
			{children}
		</section>
	);
}

function RelationList({
	rows,
	nameOf,
	subject,
}: {
	rows: ChampionRelation[];
	nameOf: (id: string) => string;
	subject: string;
}) {
	const { t } = useTranslation();
	if (!rows.length)
		return <p className="text-muted">{t("draft.card.empty")}</p>;
	return (
		<ul className="space-y-2">
			{rows.map((row) => {
				const { kind, other, value } = row;
				const name = nameOf(other);
				const tone =
					kind === "synergy"
						? "synergy"
						: value > 0
							? "advantage"
							: "disadvantage";
				const scale = kind === "synergy" ? 6 : 10;
				const level = Math.max(1, Math.round((Math.abs(value) * 5) / scale)) as
					| 1
					| 2
					| 3
					| 4
					| 5;
				const winner = value > 0 ? subject : name;
				return (
					<li
						key={JSON.stringify([kind, other, row.kind === "lane" && row.role])}
						className="bg-surface px-2.5 py-2"
					>
						<div className="flex items-baseline justify-between gap-2">
							<strong className="text-[14px]">{name}</strong>
							{row.kind !== "synergy" && (
								<span className="text-xs text-muted">
									{row.kind === "lane"
										? t(`market.role.${row.role}`)
										: t("draft.card.counter")}
								</span>
							)}
						</div>
						<div
							className={`mt-0.5 flex items-center gap-2 text-xs ${value < 0 ? "text-side-red" : "text-action"}`}
						>
							<span aria-hidden="true" className="flex shrink-0 gap-0.5">
								{[1, 2, 3, 4, 5].map((n) => (
									<span
										key={n}
										className={`h-2 w-1.5 ${n <= level ? "bg-current" : "bg-line"}`}
									/>
								))}
							</span>
							{t(`draft.card.${tone}.${level}`)}
						</div>
						{row.reasons.length > 0 && (
							<p className="mt-1 text-muted">
								{row.reasons
									.map((reason) => t(`draft.card.reason.${reason}`, { winner }))
									.join(" ")}
							</p>
						)}
					</li>
				);
			})}
		</ul>
	);
}

export function ChampionRelations({
	card,
	nameOf,
	allies,
	enemies,
	showGame,
	full = false,
}: {
	card: ChampionCardView;
	nameOf: (id: string) => string;
	allies: readonly string[];
	enemies: readonly string[];
	showGame: boolean;
	/** The detail view: every row, grouped by lane, plus team counters. */
	full?: boolean;
}) {
	const { t } = useTranslation();
	const rows = card.relations;
	const list = (subset: ChampionRelation[]) => (
		<RelationList rows={subset} nameOf={nameOf} subject={nameOf(card.id)} />
	);
	const alliesHere = rows.filter(
		(r) => r.kind === "synergy" && allies.includes(r.other),
	);
	const enemiesHere = rows.filter(
		(r) => r.kind !== "synergy" && enemies.includes(r.other),
	);
	// The global shortlist is per lane, plus team counters. Live picks use the full list.
	const best = (favorable: boolean) => {
		const candidates = rows.filter(
			(r) => r.kind !== "synergy" && r.value > 0 === favorable,
		);
		return [
			...card.positions.flatMap(({ role }) =>
				candidates
					.filter((r) => r.kind === "lane" && r.role === role)
					.slice(0, 3),
			),
			...candidates.filter((r) => r.kind === "counter").slice(0, 3),
		];
	};
	const grouped = (favorable: boolean) => {
		const candidates = rows.filter(
			(r) => r.kind !== "synergy" && r.value > 0 === favorable,
		);
		const groups = [
			...ROLES.map((role) => ({
				key: role,
				title: t(`market.role.${role}`),
				rows: candidates.filter((r) => r.kind === "lane" && r.role === role),
			})),
			{
				key: "counter",
				title: t("draft.card.teamCounters"),
				rows: candidates.filter((r) => r.kind === "counter"),
			},
		].filter((group) => group.rows.length > 0);
		if (!groups.length) return list([]);
		return groups.map((group) => (
			<div key={group.key} className="mt-2 first:mt-0">
				<h5 className="mb-1 font-semibold text-xs text-muted">{group.title}</h5>
				{list(group.rows)}
			</div>
		));
	};
	return (
		<>
			{showGame && (
				<div className="col-span-full">
					<Section title={t("draft.card.game")}>
						{!alliesHere.length && !enemiesHere.length && (
							<p className="text-muted">{t("draft.card.emptyGame")}</p>
						)}
						{(
							[
								["enemies", enemiesHere],
								["allies", alliesHere],
							] as const
						).map(
							([label, subset]) =>
								subset.length > 0 && (
									<div key={label} className="mt-2">
										<h5 className="mb-1 font-semibold text-xs text-muted">
											{t(`draft.card.${label}`)}
										</h5>
										{list(subset)}
									</div>
								),
						)}
					</Section>
				</div>
			)}
			<Section title={t("draft.card.wins")}>
				{full ? grouped(true) : list(best(true))}
			</Section>
			<Section title={t("draft.card.losses")}>
				{full ? grouped(false) : list(best(false))}
			</Section>
			<Section title={t("draft.card.synergies")}>
				{list(
					rows
						.filter((r) => r.kind === "synergy")
						.slice(0, full ? undefined : 3),
				)}
			</Section>
		</>
	);
}
