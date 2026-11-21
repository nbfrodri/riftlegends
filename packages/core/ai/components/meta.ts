import { SCALE } from "../../math";
import type { Champion } from "../content-index";

const tiers = { "S+": 6, S: 5, A: 4, B: 3, C: 2, D: 1 } as const;

export const meta = (tier: Champion["positions"][number]["tier"]) =>
	tiers[tier] * SCALE;
