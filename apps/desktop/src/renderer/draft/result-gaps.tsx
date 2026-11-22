import type { Role, SeriesOptions } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { useGoldDiff } from "../match/scoreboard";
import type { RoleGap } from "./result-data";
import { teamName } from "./session";

const numbers = (language: string) =>
	new Intl.NumberFormat(language, { maximumFractionDigits: 1 });

/**
 * The differences by role: who is ahead, by how many points (in words) and
 * how much gold (with a sign). The gap
 * rows (over the core's threshold) are marked and named in the call-out.
 */
export function GapsTable(props: {
	gaps: readonly RoleGap[];
	options: SeriesOptions;
	/** Colour of a team: a side in a game, the first or second team in a series. */
	sideOf: (team: string) => "blue" | "red";
	name: string;
	note?: string;
}) {
	const { t, i18n } = useTranslation();
	const format = numbers(i18n.language);
	const goldDiff = useGoldDiff();
	const roleLabel = (role: Role) => t(`draft.roles.role.${role}`);
	const flagged = props.gaps.filter((gap) => gap.gap);
	const roles = new Intl.ListFormat(i18n.language, {
		style: "long",
		type: "conjunction",
	}).format(flagged.map((gap) => roleLabel(gap.role)));

	return (
		<section className="bg-panel px-4 py-3 short:py-2.5">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="whitespace-nowrap font-bold font-display text-[19px] leading-tight tracking-heading">
					{t("draft.result.gaps.title")}
				</h2>
				<strong
					className={`text-right text-[13px] ${flagged.length > 0 ? "text-action" : "text-muted"}`}
				>
					{flagged.length > 0
						? t("draft.result.gaps.call", { roles })
						: t("draft.result.gaps.none")}
				</strong>
			</div>
			{props.note && <p className="text-[12px] text-muted">{props.note}</p>}
			<table
				aria-label={props.name}
				className="mt-1.5 w-full text-[14px] leading-5 tabular-nums"
			>
				<thead className="text-left text-muted">
					<tr>
						<th scope="col" className="px-1.5 py-0.5 font-normal">
							{t("draft.result.gaps.role")}
						</th>
						<th scope="col" className="px-1.5 py-0.5 font-normal">
							{t("draft.result.gaps.leader")}
						</th>
						<th scope="col" className="px-1.5 py-0.5 text-right font-normal">
							{t("draft.result.gaps.rating")}
						</th>
						<th scope="col" className="px-1.5 py-0.5 text-right font-normal">
							{t("draft.result.gaps.gold")}
						</th>
					</tr>
				</thead>
				<tbody>
					{props.gaps.map((gap) => (
						<tr
							key={gap.role}
							data-gap={gap.gap}
							className={`border-line border-t ${gap.gap ? "bg-surface" : ""}`}
						>
							<th scope="row" className="px-1.5 py-0.5 text-left font-semibold">
								<span className="flex items-center gap-1.5">
									<GameRoleIcon role={gap.role} size={16} />
									{roleLabel(gap.role)}
								</span>
							</th>
							<td className="px-1.5 py-0.5">
								{gap.team ? (
									<strong
										className={
											props.sideOf(gap.team) === "blue"
												? "text-side-blue"
												: "text-side-red"
										}
									>
										{teamName(props.options, gap.team)}
									</strong>
								) : (
									t("draft.result.gaps.even")
								)}
							</td>
							<td
								className={`px-1.5 py-0.5 text-right ${gap.gap ? "font-bold text-action" : ""}`}
							>
								{gap.team
									? t("draft.result.gaps.pointsMore", {
											count: gap.points,
											points: format.format(gap.points),
										})
									: t("draft.result.gaps.even")}
							</td>
							<td className="px-1.5 py-0.5 text-right">
								{gap.gold === 0
									? t("draft.result.gaps.even")
									: goldDiff(gap.gold)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
