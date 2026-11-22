import { z } from "zod";

export const assetRequestArgs = z.tuple([]);

export interface AssetProgress {
	readonly completed: number;
	readonly total: number;
}

export type AssetStatus =
	| { state: "missing" }
	| { state: "syncing"; progress: AssetProgress }
	| { state: "ready"; version: string }
	| { state: "error" };
