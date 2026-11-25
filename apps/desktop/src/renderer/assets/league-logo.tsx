import { Trophy } from "lucide-react";
import { useState } from "react";
import { useLeagueLogoSrc } from ".";

/** A league or event logo and a fallback with the same footprint. */
export function LeagueLogo({
	id,
	name,
	className = "size-4",
}: {
	id: string;
	name: string;
	/** Tailwind size classes; 16 px by default. */
	className?: string;
}) {
	const logo = useLeagueLogoSrc(id);
	const [failed, setFailed] = useState<string>();
	if (logo && failed !== logo) {
		return (
			<img
				src={logo}
				alt={name}
				className={`${className} shrink-0 object-contain`}
				onError={() => setFailed(logo)}
			/>
		);
	}
	return (
		<Trophy role="img" aria-label={name} className={`${className} shrink-0`} />
	);
}
