import type { MapSnapshot } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";
import { panel, panelTable, panelTitle } from "./classes";
import { MIN_LEAD_SCALE } from "./face-to-face-gold-lead";
import { FaceToFaceHeaders } from "./face-to-face-headers";
import { FaceToFaceRow, type LanePlayer } from "./face-to-face-row";
import { type TeamNames, useGoldFormat } from "./scoreboard";

export type { LanePlayer } from "./face-to-face-row";

const roles = ["top", "jungle", "mid", "bot", "support"] as const;

/** Lane by lane, blue's player on the left and red's on the right, mirrored around the role. */
export function FaceToFace({
	snapshot,
	names,
	lineup,
	vision,
}: {
	snapshot: MapSnapshot;
	lineup: ReadonlyMap<string, LanePlayer>;
	names: TeamNames;
	/** Each player's final vision score, once the game is over (`match.ended`). */
	vision?: ReadonlyMap<string, number> | undefined;
}) {
	const { t } = useTranslation();
	const format = useGoldFormat();
	const lines = roles.flatMap((role, i) => {
		const blue = snapshot.players[i];
		const red = snapshot.players[i + roles.length];
		return blue && red ? [{ role, blue, red }] : [];
	});
	const scale = Math.max(
		MIN_LEAD_SCALE,
		...lines.map(({ blue, red }) => Math.abs(blue.gold - red.gold)),
	);
	return (
		<section className={`${panel} h-full`}>
			<h2 className={panelTitle}>{t("draft.match.faceToFace")}</h2>
			<table aria-label={t("draft.match.faceToFace")} className={panelTable}>
				{/* Fixed stat columns, 16 px apart (#450); the players take the rest. */}
				<colgroup>
					<col />
					<col className="w-[66px]" />
					<col className="w-[44px]" />
					<col className="w-[60px]" />
					<col className="w-[80px]" />
					<col className="w-[60px]" />
					<col className="w-[44px]" />
					<col className="w-[66px]" />
					<col />
				</colgroup>
				<FaceToFaceHeaders names={names} />
				<tbody>
					{lines.map(({ role, blue, red }) => (
						<FaceToFaceRow
							key={role}
							role={role}
							blue={blue}
							red={red}
							lineup={lineup}
							vision={vision}
							names={names}
							scale={scale}
							format={format}
						/>
					))}
				</tbody>
			</table>
		</section>
	);
}
