import { CSPProvider } from "@base-ui/react/csp-provider";
import { Select as Primitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { withState } from "../lib/utils";

// Pass `items` to <Select> so <SelectValue> shows labels, not raw values. An
// option may carry a decorative `icon` (a logo); pass the chosen option's icon
// to <SelectTrigger> too. Icons never change the accessible names.

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

/** A decorative icon before an option's text, hidden from screen readers. */
function OptionIcon({ icon }: { icon: ReactNode }) {
	return (
		<span aria-hidden="true" className="flex size-4 shrink-0 items-center">
			{icon}
		</span>
	);
}

export function SelectTrigger({
	className,
	children,
	icon,
	...props
}: Primitive.Trigger.Props & { icon?: ReactNode }) {
	return (
		<Primitive.Trigger
			data-slot="select-trigger"
			className={withState(
				"press inline-flex min-w-0 cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-control border border-line bg-surface px-2 py-[5px] text-text select-none hover:not-data-disabled:border-muted data-popup-open:border-action data-disabled:cursor-default data-disabled:text-muted",
				className,
			)}
			{...props}
		>
			{icon ? (
				<span className="flex min-w-0 items-center gap-2">
					<OptionIcon icon={icon} />
					<span className="truncate">{children}</span>
				</span>
			) : (
				children
			)}
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
							"max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-control border border-line bg-panel py-1 text-text transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
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
	icon,
	...props
}: Primitive.Item.Props & { icon?: ReactNode }) {
	return (
		<Primitive.Item
			data-slot="select-item"
			className={withState(
				"flex cursor-pointer items-center justify-between gap-3 px-2 py-[5px] outline-none select-none data-highlighted:bg-surface data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-solid data-highlighted:outline-action data-selected:font-semibold data-disabled:cursor-default data-disabled:text-muted",
				className,
			)}
			{...props}
		>
			{icon ? (
				<span className="flex min-w-0 items-center gap-2">
					<OptionIcon icon={icon} />
					<Primitive.ItemText className="truncate">
						{children}
					</Primitive.ItemText>
				</span>
			) : (
				<Primitive.ItemText>{children}</Primitive.ItemText>
			)}
			<Primitive.ItemIndicator>
				<Check aria-hidden="true" className="size-4 shrink-0 text-action" />
			</Primitive.ItemIndicator>
		</Primitive.Item>
	);
}
