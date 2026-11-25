import { Tooltip as Primitive } from "@base-ui/react/tooltip";
import { animate } from "motion/mini";
import {
	cloneElement,
	type ReactElement,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { Kbd } from "./kbd";

type Side = NonNullable<Primitive.Positioner.Props["side"]>;

interface TooltipDetails {
	/** Body text. */
	content?: string | undefined;
	/** Optional bold first line. */
	heading?: string | undefined;
	/** Optional keyboard shortcut, shown as a `Kbd`. */
	shortcut?: string | undefined;
	/** Optional line under the text with rich content, such as an icon and a value. */
	extra?: ReactNode;
	side?: Side | undefined;
}

// Rich lines cannot live in `data-*` attributes; each trigger keeps its own here.
const extras = new WeakMap<Element, ReactNode>();

const TRIGGER = "[data-tooltip]";
// Moving to a nearby trigger shortly after one closes skips the delay.
const WARM_MS = 300;

const arrow =
	"absolute size-2 rotate-45 border-line bg-panel data-[side=bottom]:-top-[5px] data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:-right-[5px] data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-[5px] data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:-bottom-[5px] data-[side=top]:border-r data-[side=top]:border-b";

function TooltipPanel({ content, heading, shortcut, extra }: TooltipDetails) {
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
				{extra && <span className="mt-0.5 block">{extra}</span>}
			</div>
			{shortcut && <Kbd>{shortcut}</Kbd>}
		</Primitive.Popup>
	);
}

interface Shown {
	anchor: HTMLElement;
	details: TooltipDetails;
}

const read = (anchor: HTMLElement): Shown => ({
	anchor,
	details: {
		content: anchor.dataset.tooltip || undefined,
		heading: anchor.dataset.tooltipHeading,
		shortcut: anchor.dataset.tooltipShortcut,
		extra: extras.get(anchor),
		side: anchor.dataset.tooltipSide as Side | undefined,
	},
});

const triggerOf = (target: EventTarget | null) =>
	target instanceof Element ? target.closest<HTMLElement>(TRIGGER) : null;

/**
 * Mounts the one Caja tooltip of the window. It listens once at the document
 * for the `Tooltip` triggers below, so a dense grid of triggers costs nothing
 * until one is hovered or focused with the keyboard.
 */
export function TooltipProvider({
	delay = 400,
	children,
}: {
	delay?: number;
	children?: ReactNode;
}) {
	const [shown, setShown] = useState<Shown | null>(null);
	const current = useRef<HTMLElement | null>(null);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let warmUntil = 0;
		let pointer = false;
		const show = (anchor: HTMLElement, wait: number) => {
			clearTimeout(timer);
			const open = () => {
				current.current = anchor;
				setShown(read(anchor));
			};
			if (wait > 0) timer = setTimeout(open, wait);
			else open();
		};
		const hide = () => {
			clearTimeout(timer);
			if (current.current) warmUntil = performance.now() + WARM_MS;
			current.current = null;
			setShown(null);
		};
		const over = (event: PointerEvent) => {
			if (event.pointerType === "touch") return;
			const anchor = triggerOf(event.target);
			if (anchor === current.current && anchor) return;
			if (!anchor) return hide();
			const warm = current.current || performance.now() < warmUntil;
			if (current.current) hide();
			show(anchor, warm ? 0 : delay);
		};
		const leave = (event: PointerEvent) => {
			if (!triggerOf(event.relatedTarget)) hide();
		};
		const press = () => {
			pointer = true;
			hide();
		};
		const key = (event: KeyboardEvent) => {
			pointer = false;
			if (event.key === "Escape") hide();
		};
		// Only keyboard focus opens it; a click already shows what it pressed.
		const focus = (event: FocusEvent) => {
			const anchor = triggerOf(event.target);
			if (anchor && !pointer) show(anchor, 0);
		};
		const options = { capture: true };
		document.addEventListener("pointerover", over, options);
		document.addEventListener("pointerout", leave, options);
		document.addEventListener("pointerdown", press, options);
		document.addEventListener("keydown", key, options);
		document.addEventListener("focusin", focus, options);
		document.addEventListener("focusout", hide, options);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerover", over, options);
			document.removeEventListener("pointerout", leave, options);
			document.removeEventListener("pointerdown", press, options);
			document.removeEventListener("keydown", key, options);
			document.removeEventListener("focusin", focus, options);
			document.removeEventListener("focusout", hide, options);
		};
	}, [delay]);

	return (
		<>
			{children}
			<Primitive.Root open={shown !== null}>
				{shown && (
					<Primitive.Portal>
						<Primitive.Positioner
							anchor={shown.anchor}
							side={shown.details.side ?? "top"}
							sideOffset={8}
							className="pointer-events-none z-50"
						>
							<TooltipPanel {...shown.details} />
						</Primitive.Positioner>
					</Primitive.Portal>
				)}
			</Primitive.Root>
		</>
	);
}

/**
 * Shows the Caja tooltip over its child, which must pass `data-*` props to its
 * element. The tooltip is visual only: the child keeps its role, accessible
 * name and keyboard behaviour.
 */
export function Tooltip({
	children,
	disabled,
	content,
	heading,
	shortcut,
	extra,
	side,
}: TooltipDetails & {
	children: ReactElement;
	disabled?: boolean | undefined;
}) {
	if (disabled) return children;
	const props: Record<string, unknown> = {
		"data-tooltip": content ?? "",
		"data-tooltip-heading": heading,
		"data-tooltip-shortcut": shortcut,
		"data-tooltip-side": side,
	};
	// A callback ref, not a hook: the child's own ref is replaced, so only
	// triggers with an extra line pass one.
	if (extra !== undefined)
		props.ref = (element: Element | null) => {
			if (!element) return;
			extras.set(element, extra);
			return () => extras.delete(element);
		};
	return cloneElement(children, props);
}
