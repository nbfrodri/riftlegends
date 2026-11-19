import { TooltipProvider } from "@rift-legends/ui-kit/components/tooltip";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";

const draftPath = "/draft";

/**
 * Sidebar width: Draft opens collapsed on every entry and can be expanded for
 * that visit; the other screens share the width the user last chose for them.
 */
function useSidebarExpanded(pathname: string) {
	const inDraft = pathname === draftPath;
	const [expanded, setExpanded] = useState(true);
	const [draftExpanded, setDraftExpanded] = useState(false);
	const [visited, setVisited] = useState(pathname);
	if (visited !== pathname) {
		setVisited(pathname);
		if (inDraft) setDraftExpanded(false);
	}
	const toggle = useCallback(() => {
		(inDraft ? setDraftExpanded : setExpanded)((value) => !value);
	}, [inDraft]);
	return [inDraft ? draftExpanded : expanded, toggle] as const;
}

function isSidebarShortcut(event: KeyboardEvent) {
	return (
		event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey &&
		event.key.toLowerCase() === "b"
	);
}

export function Shell() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [expanded, toggle] = useSidebarExpanded(pathname);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!isSidebarShortcut(event)) return;
			event.preventDefault();
			if (!event.repeat) toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggle]);

	return (
		<TooltipProvider>
			<div className="flex min-h-0 flex-1">
				<Sidebar expanded={expanded} onToggle={toggle} pathname={pathname} />
				<main className="min-w-0 flex-1 overflow-auto">
					<Outlet />
				</main>
			</div>
		</TooltipProvider>
	);
}
