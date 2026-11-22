import {
	Coins,
	Eye,
	type LucideIcon,
	Sword,
	Swords,
	Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";
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
 * The client's scoreboard icon for a stat, painted in the text colour through
 * a CSS mask; the own icon when it is not cached or fails to load.
 */
export function StatIcon({ stat, size = 14 }: { stat: Stat; size?: number }) {
	const src = useAssetSrc("cdragon", `stats/${stat}.svg`);
	const [failed, setFailed] = useState<string>();
	// A mask that fails shows nothing, so a preload detects the failure.
	useEffect(() => {
		if (!src) return;
		let current = true;
		const probe = new Image();
		probe.onerror = () => current && setFailed(src);
		probe.src = src;
		return () => {
			current = false;
			probe.onerror = null;
		};
	}, [src]);
	const box = "inline-block shrink-0 align-[-2px]";
	if (src && src !== failed) {
		return (
			<span
				data-stat-icon=""
				aria-hidden="true"
				className={box}
				style={{
					width: size,
					height: size,
					backgroundColor: "currentColor",
					maskImage: `url(${src})`,
					maskSize: "contain",
					maskRepeat: "no-repeat",
					maskPosition: "center",
				}}
			/>
		);
	}
	const Icon = fallbacks[stat];
	return <Icon aria-hidden="true" size={size} className={box} />;
}
