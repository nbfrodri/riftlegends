import { Tooltip as Primitive } from "@base-ui/react/tooltip";
import { animate } from "motion/mini";
import {
	type ReactElement,
	type ReactNode,
	useLayoutEffect,
	useRef,
} from "react";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { Kbd } from "./kbd";

interface TooltipDetails {
	/** Body text. */
	content?: string | undefined;
	/** Optional bold first line. */
	heading?: string | undefined;
	/** Optional keyboard shortcut, shown as a `Kbd`. */
	shortcut?: string | undefined;
	side?: Primitive.Positioner.Props["side"];
}

const arrow =
	"absolute size-2 rotate-45 border-line bg-panel data-[side=bottom]:-top-[5px] data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:-right-[5px] data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-[5px] data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:-bottom-[5px] data-[side=top]:border-r data-[side=top]:border-b";

function TooltipPanel({ content, heading, shortcut }: TooltipDetails) {
	const reduced = useReducedMotion();
	const popup = useRef<HTMLDivElement>(null);
	// A quick fade on each opening; moving between triggers keeps it open.
	useLayoutEffect(() => {
		if (reduced || !popup.current) return;
		const entrance = animate(
			[popup.current],
			{ opacity: [0, 1], transform: ["translateY(2px)", "none"] },
			{ duration: 0.12, ease: "easeOut" },
		);
		return () => entrance.complete();
	}, [reduced]);
	return (
		<Primitive.Popup
			ref={popup}
			role="tooltip"
			data-slot="tooltip-content"
			className="relative flex max-w-xs items-center gap-2 rounded-control border border-line bg-panel px-2.5 py-1.5 text-[13px] text-text leading-tight shadow-[0_6px_20px_-4px_var(--color-canvas)]"
		>
			<Primitive.Arrow className={arrow} />
			<div className="min-w-0 wrap-break-word">
				{heading && <strong className="block font-bold">{heading}</strong>}
				{content && <span>{content}</span>}
			</div>
			{shortcut && <Kbd>{shortcut}</Kbd>}
		</Primitive.Popup>
	);
}

/**
 * Mounts the one Caja tooltip of the window. Every `Tooltip` trigger below it
 * shares that popup, so a dense grid only adds light triggers.
 */
export function TooltipProvider({
	delay = 400,
	children,
	...props
}: Primitive.Provider.Props & { children?: ReactNode }) {
	return (
		<Primitive.Provider delay={delay} {...props}>
			<Primitive.Root<TooltipDetails>>
				{({ payload }) => (
					<>
						{children}
						{payload && (
							<Primitive.Portal>
								<Primitive.Positioner
									side={payload.side ?? "top"}
									sideOffset={8}
									className="z-50"
								>
									<TooltipPanel {...payload} />
								</Primitive.Positioner>
							</Primitive.Portal>
						)}
					</>
				)}
			</Primitive.Root>
		</Primitive.Provider>
	);
}

/**
 * Shows the Caja tooltip over its child. The tooltip is visual only: the child
 * keeps its role, accessible name and keyboard behaviour.
 */
export function Tooltip({
	children,
	disabled,
	...details
}: TooltipDetails & {
	children: ReactElement<{ id?: string }>;
	disabled?: boolean;
}) {
	return (
		<Primitive.Trigger
			id={children.props.id}
			data-slot="tooltip-trigger"
			disabled={disabled}
			payload={details}
			render={children}
		/>
	);
}
