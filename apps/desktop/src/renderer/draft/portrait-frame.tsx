/**
 * The Caja frame over a champion portrait (#417, "Brillo"): a 2 px line border
 * that, on hover, turns action colour with a soft glow. One overlay element, so
 * the draft pool stays cheap. Its parent must be `relative`, a `group` and
 * `rounded-[4px]`; `glow` off (unavailable tiles) keeps the plain border.
 * Focus and selection are the parent's own marks, painted after it.
 */
export function PortraitFrame({ glow = true }: { glow?: boolean }) {
	return (
		<span
			data-portrait-frame=""
			data-glow={glow ? "" : undefined}
			aria-hidden
			className="portrait-frame"
		/>
	);
}
