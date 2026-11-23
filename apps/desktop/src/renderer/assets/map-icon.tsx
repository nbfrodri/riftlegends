import { type ReactNode, useState } from "react";
import { useAssetSrc } from ".";

// Original objective and structure drawings from the approved match mockup.
const paths = {
	tower: "M7 3v3h3V3h4v3h3V3h2v6l-3 2 1 8h2v2H5v-2h2l1-8-3-2V3z M10 19v-4h4v4",
	towerDown: "M3 20h18M6 17l1-5 4 1-1 4zm8 0 1-7 3 2 1 5zM4 5l3 2m11-4-2 3",
	inhibitor: "M12 2l5 7-5 7-5-7zM6 14l-2 4 8 4 8-4-2-4M8 18l4 2 4-2",
	inhibitorDown: "m6 7 4 4-2 5-4-5zm10-4 4 5-5 6-2-5zM4 17l8 4 8-4",
	nexus: "M12 2l6 8-6 9-6-9zM12 2v17M3 11v6l9 5 9-5v-6",
	nexusDown: "M9 3l-3 7 4 5zm6 0 3 7-4 5zM3 11v6l9 5 9-5v-6",
	dragon: "M3 18l5-9 5-5-1 5 8-2-3 5 4 2-3 3-7-2-3 4zM13 11h1",
	herald: "M4 7l4 2 4-5 4 5 4-2-1 9-7 5-7-5zM7 13q5-6 10 0-5 6-10 0zM12 12v2",
	baron: "M4 4l4 6 4-7 4 7 4-6-1 11-4 5-3-2-3 2-4-5zM7 12l3 1m4 0 3-1M10 16h4",
	elder: "M2 15l5-5-1-6 5 4 6-6-1 7 5-1-3 5 3 2-4 3-6-2-4 5-4-2 3-4zM14 11h1",
};

type Kind = keyof typeof paths;

/** Whether a match event kind is an objective or structure with its own icon. */
export const isObjectiveKind = (kind: string): kind is Kind =>
	Object.hasOwn(official, kind) && !kind.endsWith("Down");

// Destroyed structures reuse the official icon, greyed out.
const official: Record<Kind, string> = {
	tower: "tower",
	towerDown: "tower",
	inhibitor: "inhibitor",
	inhibitorDown: "inhibitor",
	nexus: "nexus",
	nexusDown: "nexus",
	dragon: "dragon",
	herald: "herald",
	baron: "baron",
	elder: "elder",
};

/** An objective or structure: the official icon when cached; the own drawing, or `fallback`, otherwise. */
export function MapIcon({
	kind,
	size = "size-[17px]",
	fallback,
	tinted = false,
}: {
	kind: Kind;
	/** A Tailwind size class shared by the image and its fallback. */
	size?: string;
	fallback?: ReactNode;
	/** Paint a cached icon with the owning panel's SVG colour filter. */
	tinted?: boolean;
}) {
	const box = `inline-block shrink-0 ${size} align-middle`;
	const src = useAssetSrc("cdragon", `objectives/${official[kind]}.png`);
	const [failed, setFailed] = useState<string>();
	if (src && src !== failed) {
		const paint = kind.endsWith("Down")
			? "opacity-55 grayscale"
			: tinted
				? "[filter:var(--map-icon-tint)]"
				: "";
		return (
			<img
				src={src}
				alt=""
				aria-hidden="true"
				onError={() => setFailed(src)}
				className={`${box} object-contain ${paint}`}
			/>
		);
	}
	if (fallback) return fallback;
	return (
		<svg
			className={box}
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinejoin="round"
			strokeLinecap="round"
		>
			<path d={paths[kind]} />
		</svg>
	);
}
