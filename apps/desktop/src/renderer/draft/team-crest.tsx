// Crests of the packaged fictional teams (from the approved mockups). Any other
// team shows its initial until plan 10 brings real content.
const crests: Record<string, string> = {
	forge: "M8 12h52L49 23H20zm12 16h27L36 39H23zm4 16h9l-4 13z",
	shoal:
		"M5 23 28 9l30 9-9 7-20-6-15 9zm3 13 21-12 24 7-9 7-14-5-13 8zm6 12 17-9 11 4-13 12z",
};

export function TeamCrest({ id, name }: { id: string; name: string }) {
	const path = crests[id];
	return (
		<svg viewBox="0 0 64 64" aria-hidden="true" className="h-[100px] w-[135px]">
			{path ? (
				<path fill="currentColor" d={path} />
			) : (
				<text
					x="32"
					y="46"
					textAnchor="middle"
					fontSize="44"
					fontWeight="700"
					fill="currentColor"
				>
					{name.slice(0, 1).toUpperCase()}
				</text>
			)}
		</svg>
	);
}
