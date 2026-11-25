import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import type { ComponentProps } from "react";
import { useAssetSrc } from "../assets";
import { useDraftContent } from "./session";

// Slots big enough that the 128 px icon looks blurry use the 380 px tile.
const large = new Set<ComponentProps<typeof ChampionFace>["size"]>([
	"pool",
	"role",
	"tile",
]);

/**
 * A champion's face: its cached art with real content (A3), else the drawn
 * placeholder. Large slots prefer the base skin tile and small slots prefer the
 * icon. Try the other cached image before showing the placeholder.
 */
export function ChampionPortrait(
	props: Omit<ComponentProps<typeof ChampionFace>, "src" | "fallbackSrc">,
) {
	const content = useDraftContent();
	const icon = useAssetSrc("cdragon", `champions/${props.id}.png`);
	const tile = useAssetSrc("cdragon", `tiles/${props.id}.jpg`);
	if (content !== "real" || !icon) return <ChampionFace {...props} />;
	if (!tile) return <ChampionFace {...props} src={icon} />;
	return large.has(props.size) ? (
		<ChampionFace {...props} src={tile} fallbackSrc={icon} />
	) : (
		<ChampionFace {...props} src={icon} fallbackSrc={tile} />
	);
}
