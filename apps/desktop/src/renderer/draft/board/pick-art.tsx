import { ChampionPortrait } from "../champion-portrait";

// The tile's side, in row heights. The row shows 5/8 of the tile, so faces
// near the top or off-centre stay past the fade (#438).
const SCALE = 1.6;
// Share of the hidden height cut from the top: faces sit above the centre.
const TOP = 0.3;

/**
 * The champion's art blended into its pick row, with the same framing for
 * every champion: the square tile sits against the right edge and fades in
 * from its left side, which may fall inside the row.
 */
export function PickArt(props: { id: string; label: string }) {
	return (
		<span
			data-framing="common"
			className="absolute flex aspect-square [mask-image:linear-gradient(to_right,transparent,#000_40%)]"
			style={{
				height: `${SCALE * 100}%`,
				right: "0px",
				top: `${-Math.round(TOP * (SCALE - 1) * 100)}%`,
			}}
		>
			<ChampionPortrait id={props.id} size="tile" label={props.label} />
		</span>
	);
}
