import { type CSSProperties, useState } from "react";

const sizes = {
	pool: "w-full min-h-[18px] flex-1 text-[clamp(19px,3.4vh,31px)]",
	role: "my-3 min-h-[78px] flex-1 text-[clamp(45px,5.3vw,76px)]",
	compact: "size-6 shrink-0 text-[10px]",
	ban: "size-8 shrink-0 text-[12px]",
	card: "size-[clamp(40px,7vh,76px)] shrink-0 text-[clamp(13px,2vh,20px)]",
	tile: "size-full text-[clamp(23px,2.2vw,38px)]",
};

/** The diagonal line of a banned champion, drawn by `::after` over its box. */
export const BAN_STRIKE =
	"after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom_right,transparent_calc(50%-1px),#aab3c2_50%,transparent_calc(50%+1px))]";

/** Stable hue of the draft placeholder (FNV-1a). */
function hue(id: string) {
	let hash = 2166136261;
	for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
	return (hash >>> 0) % 360;
}

export function ChampionFace({
	id,
	label,
	src,
	fallbackSrc,
	size,
	unavailable = false,
}: {
	id: string;
	/** Omit when adjacent text already names the champion. */
	label?: string;
	src?: string;
	/** Shown when `src` fails, before the initials. */
	fallbackSrc?: string;
	size: keyof typeof sizes;
	unavailable?: boolean;
}) {
	const [failed, setFailed] = useState<readonly string[]>([]);
	const shown = [src, fallbackSrc].find(
		(url): url is string => !!url && !failed.includes(url),
	);
	return (
		<span
			role="img"
			aria-label={label}
			aria-hidden={label ? undefined : true}
			style={{ "--h": hue(id) } as CSSProperties}
			className={`relative grid overflow-hidden place-items-center font-bold font-display leading-none tracking-[-0.085em] ${sizes[size]} ${
				unavailable
					? `bg-[#303744] text-[#b6beca] ${BAN_STRIKE}`
					: "bg-[hsl(var(--h)_27%_26%)] bg-[repeating-linear-gradient(126deg,transparent_0_11px,hsl(var(--h)_26%_55%/0.14)_11px_12px,transparent_12px_18px)] text-[hsl(var(--h)_53%_79%)]"
			}`}
		>
			{id.slice(0, 2).toUpperCase()}
			{shown && (
				<img
					key={shown}
					src={shown}
					alt=""
					onError={() => setFailed((urls) => [...urls, shown])}
					// Square art in a wide box: the face sits above the centre.
					className={`absolute inset-0 size-full object-cover object-[50%_30%] ${unavailable ? "grayscale" : ""}`}
				/>
			)}
		</span>
	);
}
