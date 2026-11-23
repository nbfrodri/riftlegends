import type { AiContext, Component } from "../context";
import { fictionalContent } from "./content";

export function scenario(overrides: Partial<AiContext> = {}): AiContext {
	return {
		content: fictionalContent,
		team: "forge",
		rival: "shoal",
		order: "first",
		step: 6,
		picks: {},
		bans: [],
		fearless: "off",
		game: 1,
		wins: [0, 0],
		winsNeeded: 3,
		knowsRivalPools: true,
		...overrides,
	};
}

export function points(components: Component[], key: string): number {
	return components.find((c) => c.key === key)?.points ?? 0;
}
