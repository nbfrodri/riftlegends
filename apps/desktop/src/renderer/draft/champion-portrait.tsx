import { ChampionFace } from "@rift-legends/ui-kit/components/champion-face";
import type { ComponentProps } from "react";
import { useAssetSrc } from "../assets";
import { useDraftSession } from "./session";

/**
 * A champion's face: its cached portrait with real content (A3), else the
 * drawn placeholder. A portrait that fails to load leaves the placeholder, in
 * the same box.
 */
export function ChampionPortrait(
	props: Omit<ComponentProps<typeof ChampionFace>, "src">,
) {
	const { content } = useDraftSession();
	const src = useAssetSrc("cdragon", `champions/${props.id}.png`);
	return (
		<ChampionFace {...props} {...(content === "real" && src ? { src } : {})} />
	);
}
