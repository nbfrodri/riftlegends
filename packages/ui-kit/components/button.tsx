import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { withState } from "../lib/utils";

// Caja controls: 2 px corners; on hover, a lighter fill, no underline (white
// for the filled action, surface for ghost); held, the shared `press` state
// (#376). `default` is the single filled action of a view; `ghost` is for
// secondary and icon-only actions on panels; `secondary` is an outlined action
// next to the filled one or on the canvas.
const variants = {
	default:
		"border-2 border-action bg-action px-[13px] py-[9px] font-bold text-on-action hover:not-data-disabled:border-text hover:not-data-disabled:bg-text focus-visible:outline-on-action focus-visible:-outline-offset-5 data-disabled:border-line data-disabled:bg-panel data-disabled:text-muted",
	secondary:
		"border-2 border-line px-[13px] py-[9px] font-bold text-text hover:not-data-disabled:border-text hover:not-data-disabled:bg-surface data-disabled:text-muted",
	ghost:
		"px-2 py-[5px] font-medium text-text hover:not-data-disabled:bg-surface data-disabled:text-muted",
};

type Variant = keyof typeof variants;

export type ButtonProps = ButtonPrimitive.Props & {
	variant?: Variant;
};

/**
 * The Button look, for a link that must stay a link (Base UI's advice). Links
 * already show the hand cursor, so the cursor classes live on the Button.
 */
export function buttonStyle(variant: Variant = "default") {
	return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control press select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 ${variants[variant]}`;
}

export function Button({
	variant = "default",
	className,
	...props
}: ButtonProps) {
	return (
		<ButtonPrimitive
			data-slot="button"
			data-variant={variant}
			className={withState(
				`cursor-pointer data-disabled:cursor-default ${buttonStyle(variant)}`,
				className,
			)}
			{...props}
		/>
	);
}
