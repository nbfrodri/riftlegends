import type { MapSnapshot, Role, Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { StatIcon } from "../assets/stat-icon";
import { PlayerPortrait } from "../draft/board/player-card";
import { ChampionPortrait } from "../draft/champion-portrait";
import { GoldLead, LeadText } from "./face-to-face-gold-lead";
import { nameAlign, playerTracks, statCellAlign } from "./face-to-face-headers";
import type { TeamNames } from "./scoreboard";

type Line = MapSnapshot["players"][number];

/** Who plays a lane: the player's handle and their champion. */
export interface LanePlayer {
	handle: string;
	champion: string;
	championName: string;
}

/** Greying in and out on death and respawn; instant with reduced motion (#531). */
const fade =
	"transition-[filter,opacity] duration-200 motion-reduce:transition-none";

/** Lanes whose vision tells the most: their rows show it next to the name (#510). */
const visionRoles = new Set<string>(["jungle", "support"]);

/** The vision score with the scoreboard's eye; screen readers hear it in words. */
function VisionScore({ value }: { value: number }) {
	const { t } = useTranslation();
	return (
		<span className="inline-flex items-center gap-1">
			<StatIcon stat="vision" size={14} />
			{t("draft.match.faceToFace.vision", { value })}
		</span>
	);
}

/**
 * Photo, champion portrait and the name block, in fixed tracks with the
 * pictures on the outer edge: a long name is cut, it never moves them (#433).
 */
function Player({
	id,
	player,
	side,
	vision,
	showVision,
	respawnIn,
}: {
	id: string;
	player: LanePlayer | undefined;
	side: Side;
	/** Seconds until the player respawns; undefined while alive or unknown (#531). */
	respawnIn: number | undefined;
	/** The final vision score; unknown while the game plays. */
	vision: number | undefined;
	/** Show it in the row too, not only in the tooltip. */
	showVision: boolean;
}) {
	const { t } = useTranslation();
	const inRow = showVision && vision !== undefined;
	const dead = respawnIn !== undefined;
	const dim = `${fade} ${dead ? "grayscale opacity-40" : ""}`;
	const parts = player && [
		<span key="photo" data-part="photo" className="relative flex">
			<span data-dim className={`flex ${dim}`}>
				<PlayerPortrait id={id} handle={player.handle} size="h-12 w-[38px]" />
			</span>
			{/* Plain text over the dimmed photo: it never takes a track of its own. */}
			{dead && (
				<span
					data-respawn
					aria-hidden="true"
					className="absolute inset-0 grid place-items-center font-bold text-[17px] text-text tabular-nums"
				>
					{respawnIn}
				</span>
			)}
		</span>,
		// A 28 px champion badge over the photo's lower inner corner leaves the name more room (#450, #502).
		<span
			key="champion"
			data-part="champion"
			data-dim
			className={`relative z-10 flex self-end ring-2 ring-panel [&_[role=img]]:size-7 ${side === "blue" ? "-ml-3" : "-mr-3"} ${dim}`}
		>
			<ChampionPortrait
				id={player.champion}
				label={player.championName}
				size="compact"
			/>
		</span>,
		<Tooltip
			key="name"
			heading={player.handle}
			content={player.championName}
			extra={vision === undefined ? undefined : <VisionScore value={vision} />}
		>
			<span data-part="name" className={`min-w-0 ${nameAlign[side]}`}>
				<span className="block truncate font-bold text-[15px] text-text">
					{player.handle}
				</span>
				{/* The vision score shares the champion's line: the row keeps its height (#510). */}
				<span
					aria-hidden="true"
					className={`flex min-w-0 items-center gap-1.5 truncate text-[12px] text-muted ${side === "blue" ? "justify-start" : "justify-end"}`}
				>
					<span className="truncate">{player.championName}</span>
					{inRow && (
						<span
							data-vision
							className="inline-flex shrink-0 items-center gap-0.5 font-bold text-text tabular-nums"
						>
							<StatIcon stat="vision" size={12} />
							{vision}
						</span>
					)}
				</span>
				{inRow && (
					<span className="sr-only">
						{t("draft.match.faceToFace.vision", { value: vision })}
					</span>
				)}
				{dead && (
					<span className="sr-only">
						{t("draft.match.faceToFace.respawn", { count: respawnIn })}
					</span>
				)}
			</span>
		</Tooltip>,
	];
	return (
		<td data-side={side} className="px-1!">
			{parts && (
				<span
					data-lane-player
					data-dead={dead || undefined}
					className={playerTracks[side]}
				>
					{side === "blue" ? parts : parts.reverse()}
				</span>
			)}
		</td>
	);
}

/**
 * A body number: 15 px in the normal text colour, like every other figure
 * (#502). Flex keeps its start edge even when a wide number overflows the
 * column: the overflow goes towards the lane, never past the header (#548).
 */
function Figure({
	side,
	bold = false,
	children,
}: {
	side: Side;
	bold?: boolean;
	children: ReactNode;
}) {
	return (
		<td
			className={`${statCellAlign[side]} text-[15px] text-text ${bold ? "font-bold" : ""}`}
		>
			<span
				className={`flex whitespace-nowrap ${side === "blue" ? "justify-start" : "justify-end"}`}
			>
				{children}
			</span>
		</td>
	);
}

function Kda({ line, side }: { line: Line; side: Side }) {
	return (
		<Figure side={side} bold>
			{line.kills}/{line.deaths}/{line.assists}
		</Figure>
	);
}

export function FaceToFaceRow({
	role,
	blue,
	red,
	lineup,
	vision,
	down,
	names,
	scale,
	format,
}: {
	role: Role;
	blue: Line;
	red: Line;
	lineup: ReadonlyMap<string, LanePlayer>;
	vision: ReadonlyMap<string, number> | undefined;
	/** Seconds until each dead player respawns (#531). */
	down: ReadonlyMap<string, number> | undefined;
	names: TeamNames;
	scale: number;
	format: Intl.NumberFormat;
}) {
	const { t } = useTranslation();
	return (
		// Rows grow with the window, from 56 px at 1280×720 (#502).
		<tr className="h-[clamp(56px,8.4vh,72px)] [&>*]:py-0.5!">
			<Player
				id={blue.player}
				player={lineup.get(blue.player)}
				side="blue"
				vision={vision?.get(blue.player)}
				showVision={visionRoles.has(role)}
				respawnIn={down?.get(blue.player)}
			/>
			<Kda line={blue} side="blue" />
			<Figure side="blue">{blue.cs}</Figure>
			<Figure side="blue">{format.format(blue.gold)}</Figure>
			<th scope="row">
				<span className="flex flex-col items-center gap-1.5">
					<span className="inline-flex items-center gap-1.5">
						<GameRoleIcon role={role} size={16} />
						{t(`draft.roles.role.${role}`)}
					</span>
					<GoldLead blue={blue} red={red} scale={scale} />
					<LeadText blue={blue} red={red} names={names} />
				</span>
			</th>
			<Figure side="red">{format.format(red.gold)}</Figure>
			<Figure side="red">{red.cs}</Figure>
			<Kda line={red} side="red" />
			<Player
				id={red.player}
				player={lineup.get(red.player)}
				side="red"
				vision={vision?.get(red.player)}
				showVision={visionRoles.has(role)}
				respawnIn={down?.get(red.player)}
			/>
		</tr>
	);
}
