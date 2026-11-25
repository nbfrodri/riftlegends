import { ChampionPortrait } from "../champion-portrait";

// The tile's side, in row heights: wide enough to reach towards the player's
// name (#494), while the row still shows 1/2.2 of it, so faces near the top
// or off-centre stay in view (#438).
const SCALE = 2.2;
// Share of the hidden height cut from the top: faces sit above the centre.
const TOP = 0.2;

/**
 * The champion's art blended into its pick row, with the same framing for
 * every champion: the square tile sits against the right edge and fades in
 * softly over three quarters of its width, so it blends into the player.
 */
export function PickArt(props: { id: string; label: string }) {
	return (
		<span
			data-framing="common"
			className="absolute flex aspect-square [mask-image:linear-gradient(to_right,transparent,rgb(0_0_0/0.5)_40%,#000_75%)]"
			style={{
				height: `${Math.round(SCALE * 100)}%`,
				right: "0px",
				top: `${-Math.round(TOP * (SCALE - 1) * 100)}%`,
			}}
		>
			<ChampionPortrait id={props.id} size="tile" label={props.label} />
		</span>
	);
}
