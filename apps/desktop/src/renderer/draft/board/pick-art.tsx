import type { CSSProperties } from "react";
import { ChampionPortrait } from "../champion-portrait";

interface Focus {
	/** Percent of the tile's width and height. */
	x: number;
	y: number;
}

/**
 * Where the face sits in the base skin tile, for champions whose face the
 * default framing leaves in the faded half of the row (#438). CommunityDragon
 * has no focal point, so these were read off the tiles of patch 16.23.
 */
const FOCUS: Readonly<Record<string, Focus>> = {
	Akshan: { x: 45, y: 45 },
	Braum: { x: 40, y: 22 },
	Corki: { x: 40, y: 32 },
	Ezreal: { x: 38, y: 35 },
	Gangplank: { x: 45, y: 35 },
	Gragas: { x: 40, y: 38 },
	Gwen: { x: 45, y: 42 },
	Hwei: { x: 45, y: 35 },
	Kayle: { x: 55, y: 22 },
	Kindred: { x: 68, y: 45 },
	Sett: { x: 45, y: 20 },
	Teemo: { x: 52, y: 50 },
	Urgot: { x: 50, y: 25 },
};

// Where the face lands in the art box: right of centre, past the fade.
const TARGET = { x: 0.7, y: 0.5 };
// Beyond 2x the 380 px tile looks blurry in the widest rows.
const MAX_ZOOM = 2;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Sizes and places the square tile so its focal point lands on the target,
 * zooming only as needed and never uncovering the box. Lengths use the art
 * box's container units: the tile's side is a multiple of the box's width.
 */
export function framing(focus: Focus): CSSProperties {
	const fx = focus.x / 100;
	const fy = focus.y / 100;
	const zoom = Math.min(
		MAX_ZOOM,
		Math.max(1, TARGET.x / fx, (1 - TARGET.x) / (1 - fx)),
	);
	const left = Math.min(0, Math.max(1 - zoom, TARGET.x - fx * zoom));
	return {
		width: `${round(zoom * 100)}%`,
		left: `${round(left * 100)}%`,
		top: `clamp(calc(100cqh - ${round(zoom * 100)}cqw), calc(${TARGET.y * 100}cqh - ${round(fy * zoom * 100)}cqw), 0px)`,
	};
}

/**
 * The champion's art blended into its pick row: framed on its face when the
 * champion has a focal point, else the default cover framing.
 */
export function PickArt(props: { id: string; label: string }) {
	const focus = FOCUS[props.id];
	if (!focus)
		return (
			<span data-framing="default" className="contents">
				<ChampionPortrait id={props.id} size="tile" label={props.label} />
			</span>
		);
	return (
		<span
			data-framing="focus"
			className="absolute flex aspect-square"
			style={framing(focus)}
		>
			<ChampionPortrait id={props.id} size="tile" label={props.label} />
		</span>
	);
}
