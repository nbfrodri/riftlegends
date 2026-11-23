import { useSyncExternalStore } from "react";

const media = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => media().matches;
const subscribe = (update: () => void) => {
	const query = media();
	query.addEventListener("change", update);
	return () => query.removeEventListener("change", update);
};

export const useReducedMotion = () => useSyncExternalStore(subscribe, reduced);
