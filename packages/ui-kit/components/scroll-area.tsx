import { CSPProvider } from "@base-ui/react/csp-provider";
import { ScrollArea as Primitive } from "@base-ui/react/scroll-area";
import { withState } from "../lib/utils";

// Vertical scrolling with a thin Caja scrollbar. Name the viewport through
// `viewportProps` (role and aria-label) when the region needs a landmark.
export function ScrollArea({
	className,
	children,
	viewportProps,
	...props
}: Primitive.Root.Props & { viewportProps?: Primitive.Viewport.Props }) {
	// The renderer CSP (style-src 'self') blocks the <style> Base UI would
	// inject to hide the native scrollbar, so the viewport hides it itself.
	return (
		<CSPProvider disableStyleElements>
			<Primitive.Root
				data-slot="scroll-area"
				className={withState("relative min-h-0 overflow-hidden", className)}
				{...props}
			>
				<Primitive.Viewport
					data-slot="scroll-area-viewport"
					{...viewportProps}
					className={withState(
						"size-full overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
						viewportProps?.className,
					)}
				>
					{children}
				</Primitive.Viewport>
				<Primitive.Scrollbar
					orientation="vertical"
					className="flex w-2 touch-none bg-transparent p-px select-none"
				>
					<Primitive.Thumb className="w-full rounded-control bg-line hover:bg-muted" />
				</Primitive.Scrollbar>
			</Primitive.Root>
		</CSPProvider>
	);
}
