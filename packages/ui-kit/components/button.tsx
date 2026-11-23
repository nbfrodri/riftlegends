import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { withState } from "../lib/utils";

// Caja controls: 2 px corners; on hover, a lighter fill, never an underline (white
// for the filled action, surface for ghost); held, the shared `press` state
// (#376). `default` is the single filled action of a view; `ghost` is for
// secondary and icon-only actions on panels.
const variants = {
	default:
		"border-2 border-action bg-action px-[13px] py-[9px] font-bold text-on-action hover:not-data-disabled:border-text hover:not-data-disabled:bg-text focus-visible:outline-on-action focus-visible:-outline-offset-5 data-disabled:border-line data-disabled:bg-panel data-disabled:text-muted",
	ghost:
		"px-2 py-[5px] font-medium text-text hover:not-data-disabled:bg-surface data-disabled:text-muted",
};

export type ButtonProps = ButtonPrimitive.Props & {
	variant?: keyof typeof variants;
};

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
				`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control press select-none data-disabled:cursor-default [&_svg]:pointer-events-none [&_svg]:shrink-0 ${variants[variant]}`,
				className,
			)}
			{...props}
		/>
	);
}
