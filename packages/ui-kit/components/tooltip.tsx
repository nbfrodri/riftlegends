import { Tooltip as Primitive } from "@base-ui/react/tooltip";
import { withState } from "../lib/utils";

// Tooltips are visual only (Base UI): give every trigger its own aria-label.

export function TooltipProvider({
	delay = 400,
	...props
}: Primitive.Provider.Props) {
	return <Primitive.Provider delay={delay} {...props} />;
}

export const Tooltip = Primitive.Root;

export function TooltipTrigger(props: Primitive.Trigger.Props) {
	return <Primitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipContent({
	className,
	side = "right",
	align = "center",
	sideOffset = 6,
	...props
}: Primitive.Popup.Props &
	Pick<Primitive.Positioner.Props, "side" | "align" | "sideOffset">) {
	return (
		<Primitive.Portal>
			<Primitive.Positioner
				side={side}
				align={align}
				sideOffset={sideOffset}
				className="z-50"
			>
				<Primitive.Popup
					data-slot="tooltip-content"
					className={withState(
						"flex max-w-xs items-center gap-2 rounded-control border border-line bg-panel px-2 py-1 text-[13px] text-text transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-instant:transition-none data-starting-style:opacity-0 motion-reduce:transition-none",
						className,
					)}
					{...props}
				/>
			</Primitive.Positioner>
		</Primitive.Portal>
	);
}
