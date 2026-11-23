import { type ReactNode, useCallback, useEffect, useState } from "react";
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
}

/**
 * All portraits share one inspector. The card opens only on purpose, by right
 * click or the key I, never on hover or focus (#365); Escape closes it.
 */
export function ChampionInspection({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState<Inspection | null>(null);
	const close = useCallback(() => {
		open?.trigger.focus({ preventScroll: true });
		setOpen(null);
	}, [open]);
	useEffect(() => {
		if (!open) return;
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [open, close]);
	function show(trigger: HTMLElement) {
		const id = trigger.dataset.cardChampion;
		if (id) setOpen({ id, trigger });
	}
	return (
		<fieldset
			className="relative m-0 grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-3 border-0 p-0"
			onContextMenu={(e) => {
				const trigger = triggerOf(e.target);
				if (trigger) {
					e.preventDefault();
					show(trigger);
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
					show(trigger);
				} else if (open && inCard(e.target)) {
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
					left={!!open.trigger.closest("[data-card-side=red]")}
					onClose={close}
				/>
			)}
		</fieldset>
	);
}
