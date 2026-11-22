import { useState } from "react";

const rolePaths = {
	top: "M3 14l9-9 9 9-4 4-5-5-5 5z",
	jungle: "M6 18v-8l6-6h8v8l-6 6z M3 21l11-11",
	mid: "M12 3l9 9-9 9-9-9z",
	bot: "M9 9h6v6H9z M12 3v3 M12 18v3 M3 12h3 M18 12h3",
	support: "M4 5h16v8l-8 7-8-7z M9 11h6 M12 8v6",
};

export type RoleIconProps = {
	role: keyof typeof rolePaths;
	size?: 16 | 20 | 24;
	label?: string;
	/** Official image; the own icon replaces it while missing or broken. */
	src?: string;
};

export function RoleIcon({ role, size = 20, label, src }: RoleIconProps) {
	const [failed, setFailed] = useState<string>();
	if (src && src !== failed) {
		return (
			<img
				key={src}
				src={src}
				width={size}
				height={size}
				alt={label ?? ""}
				aria-hidden={label ? undefined : true}
				onError={() => setFailed(src)}
				className="inline-block shrink-0 object-contain"
			/>
		);
	}
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinejoin="bevel"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<path d={rolePaths[role]} />
		</svg>
	);
}
