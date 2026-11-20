import { CSPProvider } from "@base-ui/react/csp-provider";
import { Select as Primitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { withState } from "../lib/utils";

// Pass `items` to <Select> so <SelectValue> shows labels, not raw values.
export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

export function SelectTrigger({
	className,
	children,
	...props
}: Primitive.Trigger.Props) {
	return (
		<Primitive.Trigger
			data-slot="select-trigger"
			className={withState(
				"inline-flex min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-control border border-line bg-surface px-2 py-[5px] text-text select-none hover:not-data-disabled:border-muted data-popup-open:border-action data-disabled:cursor-default data-disabled:text-muted",
				className,
			)}
			{...props}
		>
			{children}
			<Primitive.Icon
				render={
					<ChevronDown
						aria-hidden="true"
						className="size-4 shrink-0 text-muted"
					/>
				}
			/>
		</Primitive.Trigger>
	);
}

export function SelectContent({
	className,
	children,
	...props
}: Primitive.Popup.Props) {
	// The renderer CSP (style-src 'self') blocks the <style> Base UI would inject.
	return (
		<CSPProvider disableStyleElements>
			<Primitive.Portal>
				<Primitive.Positioner
					side="bottom"
					align="start"
					sideOffset={4}
					alignItemWithTrigger={false}
					className="z-50"
				>
					<Primitive.Popup
						data-slot="select-content"
						className={withState(
							"max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-control border border-line bg-panel py-1 text-text [scrollbar-color:var(--color-line)_var(--color-panel)] transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
							className,
						)}
						{...props}
					>
						<Primitive.List>{children}</Primitive.List>
					</Primitive.Popup>
				</Primitive.Positioner>
			</Primitive.Portal>
		</CSPProvider>
	);
}

export function SelectItem({
	className,
	children,
	...props
}: Primitive.Item.Props) {
	return (
		<Primitive.Item
			data-slot="select-item"
			className={withState(
				"flex cursor-default items-center justify-between gap-3 px-2 py-[5px] outline-none select-none data-highlighted:bg-surface data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-solid data-highlighted:outline-action data-selected:font-semibold data-disabled:text-muted",
				className,
			)}
			{...props}
		>
			<Primitive.ItemText>{children}</Primitive.ItemText>
			<Primitive.ItemIndicator>
				<Check aria-hidden="true" className="size-4 shrink-0 text-action" />
			</Primitive.ItemIndicator>
		</Primitive.Item>
	);
}
