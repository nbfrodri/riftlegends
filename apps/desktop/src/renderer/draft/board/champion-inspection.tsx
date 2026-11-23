import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ChampionCard } from "./champion-card";

const triggerOf = (node: EventTarget | null) =>
	node instanceof Element
		? node.closest<HTMLElement>("[data-card-champion]")
		: null;
const inCard = (node: EventTarget | null) =>
	node instanceof Element && !!node.closest("[data-champion-card]");

interface Inspection {
	id: string;
	trigger: HTMLElement;
	pinned: boolean;
}

/** All portraits share one inspector. Previewing never takes focus from the grid. */
export function ChampionInspection({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState<Inspection | null>(null);
	const timer = useRef<number | undefined>(undefined);
	const returning = useRef(false);
	const pointerFocus = useRef<HTMLElement | null>(null);
	const cancel = useCallback(() => window.clearTimeout(timer.current), []);
	useEffect(() => cancel, [cancel]);
	const close = useCallback(() => {
		cancel();
		if (open?.pinned) {
			returning.current = true;
			open.trigger.focus({ preventScroll: true });
			returning.current = false;
		}
		setOpen(null);
	}, [cancel, open]);
	useEffect(() => {
		if (!open) return;
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
		};
		const outside = (event: PointerEvent) => {
			if (!open.pinned && !inCard(event.target) && !triggerOf(event.target)) {
				cancel();
				setOpen(null);
			}
		};
		document.addEventListener("keydown", onEscape);
		document.addEventListener("pointerdown", outside);
		return () => {
			document.removeEventListener("keydown", onEscape);
			document.removeEventListener("pointerdown", outside);
		};
	}, [open, close, cancel]);
	function show(trigger: HTMLElement, pinned: boolean) {
		const id = trigger.dataset.cardChampion;
		if (!id) return;
		cancel();
		setOpen({ id, trigger, pinned });
	}
	function leave(next: EventTarget | null) {
		if (open?.pinned) return;
		cancel();
		if (inCard(next)) return;
		timer.current = window.setTimeout(() => setOpen(null), 140);
	}
	return (
		<fieldset
			className="relative m-0 grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-3 border-0 p-0"
			onPointerDown={(e) => {
				pointerFocus.current = triggerOf(e.target);
				if (pointerFocus.current) cancel();
			}}
			onPointerUp={() => {
				pointerFocus.current = null;
			}}
			onPointerCancel={() => {
				pointerFocus.current = null;
			}}
			onMouseOver={(e) => {
				if (open?.pinned) return;
				if (inCard(e.target)) {
					cancel();
					return;
				}
				const trigger = triggerOf(e.target);
				if (trigger && trigger !== triggerOf(e.relatedTarget)) {
					cancel();
					timer.current = window.setTimeout(() => show(trigger, false), 200);
				}
			}}
			onMouseOut={(e) => {
				if (
					triggerOf(e.target) !== triggerOf(e.relatedTarget) ||
					(inCard(e.target) && !inCard(e.relatedTarget))
				)
					leave(e.relatedTarget);
			}}
			onFocus={(e) => {
				const trigger = triggerOf(e.target);
				if (
					trigger &&
					trigger !== pointerFocus.current &&
					!open?.pinned &&
					!returning.current
				)
					show(trigger, false);
			}}
			onBlur={(e) => {
				if (triggerOf(e.target)) leave(e.relatedTarget);
			}}
			onContextMenu={(e) => {
				const trigger = triggerOf(e.target);
				if (trigger) {
					e.preventDefault();
					show(trigger, true);
				}
			}}
			onKeyDown={(e) => {
				if (
					e.key.toLowerCase() !== "i" ||
					e.altKey ||
					e.metaKey ||
					e.ctrlKey ||
					e.repeat
				)
					return;
				const trigger = triggerOf(e.target);
				if (trigger) {
					e.preventDefault();
					show(trigger, true);
				} else if (open?.pinned && inCard(e.target)) {
					e.preventDefault();
					close();
				}
			}}
		>
			{children}
			{open && (
				<ChampionCard
					key={open.id}
					id={open.id}
					pinned={open.pinned}
					left={!!open.trigger.closest("[data-card-side=red]")}
					onPin={() => show(open.trigger, true)}
					onClose={close}
				/>
			)}
		</fieldset>
	);
}
