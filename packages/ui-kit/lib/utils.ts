import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the Caja scales from tokens.css. Without them it reads
// `text-table` as a colour (and drops it next to `text-text`) and never lets a
// later class override `rounded-control`, `tracking-heading` or `px-gutter`.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["table"],
			radius: ["control"],
			tracking: ["heading", "champion", "team"],
			spacing: ["gutter", "gap"],
			ease: ["lock"],
		},
	},
});

export function cn(...classes: ClassValue[]) {
	return twMerge(clsx(classes));
}

// Base UI also accepts a className derived from the component state.
export function withState<State>(
	base: string,
	className: string | ((state: State) => string | undefined) | undefined,
) {
	return typeof className === "function"
		? (state: State) => cn(base, className(state))
		: cn(base, className);
}
