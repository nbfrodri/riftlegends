import type { AiContent, Side } from "@rift-legends/contracts";
import type { Fearless } from "../draft/availability";

export interface AiContext {
	readonly content: AiContent;
	readonly team: string;
	readonly rival: string;
	readonly side: Side;
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
