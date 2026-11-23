import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import type { ComponentProps } from "react";
import { useAssetSrc } from "../assets";
import { useDraftContent } from "./session";

// Slots big enough that the 128 px icon looks blurry use the 380 px tile.
const large = new Set<ComponentProps<typeof ChampionFace>["size"]>([
	"pool",
	"role",
]);

/**
 * A champion's face: its cached art with real content (A3), else the drawn
 * placeholder. Large slots show the base skin tile and fall back to the icon;
 * an image that fails to load leaves the placeholder, in the same box.
 */
export function ChampionPortrait(
	props: Omit<ComponentProps<typeof ChampionFace>, "src" | "fallbackSrc">,
) {
	const content = useDraftContent();
	const icon = useAssetSrc("cdragon", `champions/${props.id}.png`);
	const tile = useAssetSrc("cdragon", `tiles/${props.id}.jpg`);
	if (content !== "real" || !icon) return <ChampionFace {...props} />;
	return large.has(props.size) && tile ? (
		<ChampionFace {...props} src={tile} fallbackSrc={icon} />
	) : (
		<ChampionFace {...props} src={icon} />
	);
}
