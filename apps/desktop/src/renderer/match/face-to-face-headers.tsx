import type { Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { StatIcon } from "../assets/stat-icon";
import type { TeamNames } from "./scoreboard";

/**
 * The player column's tracks, shared by its header and every row: photo,
 * the visible part of the champion badge, then the name. Fixed widths, so
 * the name starts at the same place whatever the font (#548).
 */
export const playerTracks = {
	blue: "grid grid-cols-[38px_16px_minmax(0,1fr)] items-center",
	red: "grid grid-cols-[minmax(0,1fr)_16px_38px] items-center",
} as const;
/** The name sits next to the pictures: start-aligned, mirrored on red (#548). */
export const nameAlign = {
	blue: "col-start-3 ml-1.5 text-left",
	red: "col-start-1 row-start-1 mr-1.5 text-right",
} as const;

/** «Player» header, aligned like the names below it (#548). */
function PlayerHeader({ side }: { side: Side }) {
	const { t } = useTranslation();
	return (
		<th scope="col" className="px-1!">
			<span className={playerTracks[side]}>
				<span className={`min-w-0 truncate ${nameAlign[side]}`}>
					{t("draft.match.faceToFace.player")}
				</span>
			</span>
		</th>
	);
}

const columns = ["kda", "cs", "gold"] as const;
/**
 * Stat cells: 8 px each side, so neighbouring columns stay 16 px apart (#450).
 * Header and figures start at the same edge, the player's side (#548).
 */
export const statCellAlign = {
	blue: "px-2! tabular-nums text-left!",
	red: "px-2! tabular-nums text-right!",
} as const;
function StatHeader({
	column,
	side,
}: {
	column: (typeof columns)[number];
	side: Side;
}) {
	const { t } = useTranslation();
	return (
		// Icon over label with a 4 px gap (#509), on the same edge as the figures (#548).
		<th scope="col" className={`py-1! ${statCellAlign[side]}`}>
			<span
				className={`flex flex-col gap-1 ${side === "blue" ? "items-start" : "items-end"}`}
			>
				<StatIcon stat={column} size={18} />
				{t(`draft.match.faceToFace.${column}`)}
			</span>
		</th>
	);
}

export function FaceToFaceHeaders({ names }: { names: TeamNames }) {
	const { t } = useTranslation();
	return (
		<thead>
			<tr>
				<th scope="colgroup" data-side="blue" colSpan={4} className="py-0.5!">
					{names.blue}
				</th>
				<td />
				<th scope="colgroup" data-side="red" colSpan={4} className="py-0.5!">
					{names.red}
				</th>
			</tr>
			<tr className="text-[12px]">
				<PlayerHeader side="blue" />
				{columns.map((column) => (
					<StatHeader key={column} column={column} side="blue" />
				))}
				<th scope="col">{t("draft.match.lane")}</th>
				{[...columns].reverse().map((column) => (
					<StatHeader key={column} column={column} side="red" />
				))}
				<PlayerHeader side="red" />
			</tr>
		</thead>
	);
}
