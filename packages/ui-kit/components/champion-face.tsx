import { type CSSProperties, useState } from "react";

const sizes = {
	pool: "w-full min-h-[18px] flex-1 text-[clamp(19px,3.4vh,31px)]",
	role: "my-3 min-h-[78px] flex-1 text-[clamp(45px,5.3vw,76px)]",
	compact: "size-6 shrink-0 text-[12px]",
};

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
	size,
	unavailable = false,
}: {
	id: string;
	/** Omit when adjacent text already names the champion. */
	label?: string;
	src?: string;
	size: keyof typeof sizes;
	unavailable?: boolean;
}) {
	const [failed, setFailed] = useState<string>();
	return (
		<span
			role="img"
			aria-label={label}
			aria-hidden={label ? undefined : true}
			style={{ "--h": hue(id) } as CSSProperties}
			className={`relative grid overflow-hidden place-items-center font-bold font-display leading-none tracking-[-0.085em] ${sizes[size]} ${
				unavailable
					? "bg-[#303744] text-[#b6beca] after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom_right,transparent_calc(50%-1px),#aab3c2_50%,transparent_calc(50%+1px))]"
					: "bg-[hsl(var(--h)_27%_26%)] bg-[repeating-linear-gradient(126deg,transparent_0_11px,hsl(var(--h)_26%_55%/0.14)_11px_12px,transparent_12px_18px)] text-[hsl(var(--h)_53%_79%)]"
			}`}
		>
			{id.slice(0, 2).toUpperCase()}
			{src && src !== failed && (
				<img
					key={src}
					src={src}
					alt=""
					onError={() => setFailed(src)}
					className={`absolute inset-0 size-full object-cover ${unavailable ? "grayscale" : ""}`}
				/>
			)}
		</span>
	);
}
