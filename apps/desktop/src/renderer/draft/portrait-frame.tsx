/**
 * The Caja frame over a champion portrait (#417): a thin line border, corner
 * marks in the action colour and a soft inner shadow, in one overlay element so
 * the draft pool stays cheap. Its parent must be `relative` and a `group`; on
 * hover (when `hover` is on) the border brightens. Focus and selection are the
 * parent's own marks, painted after it.
 */
export function PortraitFrame({ hover = true }: { hover?: boolean }) {
	return (
		<span
			data-portrait-frame=""
			aria-hidden
			className={`portrait-frame${hover ? " group-hover:border-muted" : ""}`}
		/>
	);
}
