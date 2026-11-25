import { type CSSProperties, useState } from "react";
import { useAssetSrc } from "../../assets";
import { ChampionPortrait } from "../champion-portrait";
import { useDraftContent } from "../session";

interface Focus {
	/** Percent of the tile's width and height. */
	x: number;
	y: number;
}

/**
 * Where the face sits in the base skin tile, for champions whose face the
 * default framing leaves in the faded half of the row (#438, #494). CommunityDragon
 * has no focal point, so these were read off the tiles of patch 16.23.
 */
const FOCUS: Readonly<Record<string, Focus>> = {
	Aatrox: { x: 48, y: 60 },
	Akshan: { x: 45, y: 45 },
	Braum: { x: 50, y: 27 },
	Caitlyn: { x: 49, y: 40 },
	Corki: { x: 40, y: 32 },
	Ezreal: { x: 38, y: 35 },
	Gangplank: { x: 45, y: 35 },
	Gragas: { x: 40, y: 38 },
	Gwen: { x: 45, y: 42 },
	Hwei: { x: 45, y: 35 },
	Kayle: { x: 55, y: 22 },
	Kindred: { x: 68, y: 45 },
	Sett: { x: 45, y: 20 },
	Teemo: { x: 60, y: 44 },
	Urgot: { x: 50, y: 25 },
};

// Where the face lands in the art box: right of centre, past the fade.
const TARGET = { x: 0.7, y: 0.5 };
// Beyond 2x the 380 px tile looks blurry in the widest rows.
const MAX_ZOOM = 2;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Where the face sits in the centred splash, for champions whose face the
 * default point cuts in the row (#494). Read off the 16.23 splashes.
 */
const SPLASH_FOCUS: Readonly<Record<string, Focus>> = {
	Braum: { x: 50, y: 26 },
	Illaoi: { x: 50, y: 22 },
	Orianna: { x: 50, y: 24 },
	Tryndamere: { x: 53, y: 33 },
};
// Faces in the centred splash sit at the middle, a third from the top.
const SPLASH_DEFAULT: Focus = { x: 50, y: 33 };
// Big enough to read the face in a wide row; the 1280 px splash stays sharp.
const SPLASH_ZOOM = 1.5;
// 16:9 splash: its height in widths.
const SPLASH_RATIO = 9 / 16;
// Where the splash's face lands in the art box: right of centre, past the fade.
const SPLASH_TARGET = { x: 0.62, y: 0.5 };

/** Where the champion's face sits in its centred splash. */
export function splashFocus(id: string): Focus {
	return SPLASH_FOCUS[id] ?? SPLASH_DEFAULT;
}

/**
 * Sizes and places the landscape splash, in percent of the art box (its height in
 * container units), so its focal point lands right of centre without
 * uncovering the box.
 */
export function splashFraming(focus: Focus) {
	const fx = focus.x / 100;
	const fy = focus.y / 100;
	const zoom = SPLASH_ZOOM;
	const left = Math.min(0, Math.max(1 - zoom, SPLASH_TARGET.x - fx * zoom));
	const height = round(zoom * SPLASH_RATIO * 100);
	return {
		width: `${round(zoom * 100)}%`,
		left: `${round(left * 100)}%`,
		top: `clamp(calc(100cqh - ${height}cqw), calc(${SPLASH_TARGET.y * 100}cqh - ${round(fy * zoom * SPLASH_RATIO * 100)}cqw), 0px)`,
	};
}

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
 * The champion's art blended into its pick row. With real content, the base
 * skin's landscape splash covers the art box (#494); without it (fictional
 * content, or a splash that failed to load) the square tile, framed on its
 * face when the champion has a focal point, else the default cover framing.
 */
export function PickArt(props: { id: string; label: string }) {
	const content = useDraftContent();
	const splash = useAssetSrc("cdragon", `splashes/${props.id}.jpg`);
	const [failed, setFailed] = useState(false);
	if (content === "real" && splash && !failed)
		return (
			<span
				data-framing="splash"
				role="img"
				aria-label={props.label}
				className="absolute inset-0 flex"
			>
				<img
					src={splash}
					alt=""
					onError={() => setFailed(true)}
					className="absolute aspect-video max-w-none"
					style={splashFraming(splashFocus(props.id))}
				/>
			</span>
		);
	return <TileArt {...props} />;
}

/**
 * The tile fallback in its own box, 3/5 of the row (70.6 % of the splash
 * box): the square tile is framed for that width (#438). The box starts inside
 * the row's fade, so it fades in from its own left edge too (#549).
 */
function TileArt(props: { id: string; label: string }) {
	return (
		<span className="absolute inset-y-0 right-0 flex w-[70.6%] overflow-hidden [container-type:size] [mask-image:linear-gradient(to_right,transparent,#000_45%)]">
			<TileFraming {...props} />
		</span>
	);
}

function TileFraming(props: { id: string; label: string }) {
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
