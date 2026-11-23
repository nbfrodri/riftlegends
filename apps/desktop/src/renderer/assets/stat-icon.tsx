import {
	Coins,
	Eye,
	type LucideIcon,
	Sword,
	Swords,
	Wheat,
} from "lucide-react";
import { useState } from "react";
import { useAssetSrc } from ".";

// Own icons for when the client's are not cached (offline or fictional mode).
const fallbacks = {
	kda: Swords,
	gold: Coins,
	cs: Wheat,
	damage: Sword,
	vision: Eye,
} satisfies Record<string, LucideIcon>;

export type Stat = keyof typeof fallbacks;

/**
 * The client's scoreboard icon for a stat; the own icon when it is not cached
 * or fails to load. A plain image: a CSS mask over a rift-asset:// SVG does not
 * load in Electron (#312).
 */
export function StatIcon({ stat, size = 14 }: { stat: Stat; size?: number }) {
	const src = useAssetSrc("cdragon", `stats/${stat}.svg`);
	const [failed, setFailed] = useState<string>();
	const box = "inline-block shrink-0 align-[-2px]";
	if (src && src !== failed) {
		return (
			<img
				src={src}
				alt=""
				aria-hidden="true"
				width={size}
				height={size}
				onError={() => setFailed(src)}
				className={`${box} object-contain brightness-200`}
			/>
		);
	}
	const Icon = fallbacks[stat];
	return <Icon aria-hidden="true" size={size} className={box} />;
}
