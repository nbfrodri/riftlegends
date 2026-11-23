import type { Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { type CSSProperties, useId } from "react";
import { useTranslation } from "react-i18next";
import { MapIcon } from "../assets/map-icon";
import { panel, panelTable, panelTitle } from "./classes";
import { clockTime } from "./playback";
import { type TeamMap, TIERS } from "./team-map";

type Structure = "tower" | "inhibitor" | "nexus";

/** A structure's icon in the team colour, greyed once destroyed; its state is its name and tooltip. */
function StructureState({
	kind,
	standing,
}: {
	kind: Structure;
	standing: boolean;
}) {
	const { t } = useTranslation();
	const icon = standing ? kind : (`${kind}Down` as const);
	const label = t(`draft.match.${icon}`);
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				data-down={!standing}
				className={`relative inline-flex align-middle ${standing ? "text-(--side)" : "text-muted [&_svg]:opacity-55 after:absolute after:inset-x-0 after:top-1/2 after:h-0.5 after:-rotate-45 after:rounded-full after:bg-current"}`}
			>
				<MapIcon kind={icon} size="size-6" tinted={standing} />
			</span>
		</Tooltip>
	);
}

function Structures({ name, view }: { name: string; view: TeamMap }) {
	const { t } = useTranslation();
	return (
		<table
			aria-label={t("draft.match.teamStructures", { team: name })}
			className={`${panelTable} h-full [&_th[scope=row]]:text-left [&_th[scope=row]]:text-muted`}
		>
			<colgroup>
				<col className="w-[26%]" />
				<col span={3} />
				<col className="w-16" />
			</colgroup>
			<thead>
				<tr className="text-[11px] [&_th]:font-normal">
					<th scope="col">
						<span className="sr-only">{t("draft.match.lane")}</span>
					</th>
					{TIERS.map((tier) => (
						<th scope="col" key={tier}>
							{t(`draft.match.column.${tier}`)}
						</th>
					))}
					<th scope="col">{t("draft.match.column.inhibitor")}</th>
				</tr>
			</thead>
			<tbody>
				{view.lanes.map(({ lane, towers, inhibitor }) => (
					<tr key={lane}>
						<th scope="row">{t(`draft.match.zone.lane-${lane}`)}</th>
						{towers.map(({ tier, standing }) => (
							<td key={tier}>
								<StructureState kind="tower" standing={standing} />
							</td>
						))}
						<td className="whitespace-nowrap">
							<StructureState kind="inhibitor" standing={inhibitor.standing} />
							{inhibitor.respawnIn !== null && (
								<small className="ml-1 text-[12px]">
									<span className="sr-only">{t("draft.match.backIn")} </span>
									<span>{clockTime(inhibitor.respawnIn)}</span>
								</small>
							)}
						</td>
					</tr>
				))}
				<tr>
					<th scope="row" className="whitespace-nowrap">
						{t("draft.match.kind.nexus")}
					</th>
					<td colSpan={3}>
						<span className="inline-flex gap-2">
							{view.nexus.towers.map((standing, index) => (
								<StructureState
									// biome-ignore lint/suspicious/noArrayIndexKey: the two nexus towers are fixed slots.
									key={index}
									kind="tower"
									standing={standing}
								/>
							))}
						</span>
					</td>
					<td>
						<StructureState kind="nexus" standing={view.nexus.standing} />
					</td>
				</tr>
			</tbody>
		</table>
	);
}

const objectives = ["dragon", "herald", "baron", "elder"] as const;

function Objectives({ view }: { view: TeamMap }) {
	const { t } = useTranslation();
	const { dragons, soul } = view.objectives;
	const value = (kind: (typeof objectives)[number]) =>
		kind === "dragon"
			? t("draft.match.dragonCount", { count: dragons })
			: view.objectives[`${kind}s`];
	const effects = [
		...(soul ? [{ icon: "dragon" as const, text: t("draft.match.soul") }] : []),
		...view.effects.map(({ kind, remaining }) => ({
			icon: kind,
			text: t("draft.match.effectTime", {
				effect: t(`draft.match.kind.${kind}`),
				time: clockTime(remaining),
			}),
		})),
	];
	return (
		<>
			<dl className="grid grid-cols-4 gap-x-3 text-center">
				{objectives.map((kind) => {
					const taken = view.objectives[`${kind}s`] > 0;
					return (
						<div
							key={kind}
							data-taken={taken}
							className="grid min-w-0 grid-cols-[auto_auto] items-center justify-center gap-x-2 gap-y-1"
						>
							{/* Icon and count share a line; the name sits below. */}
							<dt className="contents">
								<span className={`row-start-1 ${taken ? "" : "opacity-45"}`}>
									<MapIcon kind={kind} size="size-6" tinted={taken} />
								</span>
								<span className="col-span-2 row-start-2 truncate text-[12px] text-muted">
									{t(`draft.match.objective.${kind}`)}
								</span>
							</dt>
							<dd
								className={`row-start-1 whitespace-nowrap font-bold text-[15px] ${taken ? "text-(--side)" : ""}`}
							>
								{value(kind)}
							</dd>
						</div>
					);
				})}
			</dl>
			{effects.length > 0 ? (
				<ul
					aria-label={t("draft.match.effects")}
					className="flex flex-wrap gap-x-3 gap-y-1 font-bold text-(--side)"
				>
					{effects.map(({ icon, text }) => (
						<li key={icon} className="flex items-center gap-1.5">
							<MapIcon kind={icon} tinted />
							{text}
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted">{t("draft.match.noEffects")}</p>
			)}
		</>
	);
}

/** One team's base and objectives, in its side colour. */
export function TeamPanel({
	side,
	name,
	view,
}: {
	side: Side;
	name: string;
	view: TeamMap;
}) {
	const { t } = useTranslation();
	const tint = useId();
	return (
		<section
			aria-label={t("draft.match.teamMap", { team: name })}
			data-side={side}
			className={`${panel} relative row-span-6 grid grid-rows-subgrid gap-y-3 border-(--side) border-t-[3px]`}
			style={{ "--map-icon-tint": `url(#${tint})` } as CSSProperties}
		>
			<svg aria-hidden="true" className="absolute size-0">
				<defs>
					<filter id={tint}>
						{/* A CSS variable only resolves in a style, not an SVG attribute. */}
						<feFlood style={{ floodColor: "var(--side)" }} />
						<feComposite in2="SourceAlpha" operator="in" />
					</filter>
				</defs>
			</svg>
			<h2 className={`${panelTitle} text-(--side) [overflow-wrap:anywhere]`}>
				{name}
			</h2>
			<p className="flex items-baseline justify-between gap-2">
				<span className="text-muted">{t("draft.match.towersStanding")}</span>
				<b>
					{t("draft.match.ofTotal", {
						count: view.towers.standing,
						total: view.towers.total,
					})}
				</b>
			</p>
			<Structures name={name} view={view} />
			<hr className="my-1 border-line" />
			<Objectives view={view} />
		</section>
	);
}
