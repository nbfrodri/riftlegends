import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

// A key or shortcut ("Alt+B"), set in Archivo with tabular figures.
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"inline-flex h-5 min-w-5 items-center justify-center rounded-control border border-line bg-canvas px-1 font-sans text-[12px] font-semibold text-muted tabular-nums select-none",
				className,
			)}
			{...props}
		/>
	);
}
