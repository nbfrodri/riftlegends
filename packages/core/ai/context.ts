import type { AiContent } from "@rift-legends/contracts";
import type { Fearless } from "../draft/availability";
import type { Order } from "../draft/order";

export interface AiContext {
	readonly content: AiContent;
	readonly team: string;
	readonly rival: string;
	/** Whether the team picks first or last, whatever its map side (issue #305). */
	readonly order: Order;
	readonly step: number;
	readonly picks: Readonly<Record<string, readonly string[]>>;
	readonly bans: readonly (string | null)[];
	readonly fearless: Fearless;
	readonly game: number;
	/** Wins in [team, rival] order. */
	readonly wins: readonly [number, number];
	readonly winsNeeded: number;
	readonly knowsRivalPools: boolean;
}

export interface Component {
	readonly key: string;
	readonly points: number;
}

export function nonzeroComponents(
	scores: Readonly<Record<string, number>>,
): Component[] {
	return Object.entries(scores)
		.filter(([, points]) => points !== 0)
		.map(([key, points]) => ({ key, points }));
}
