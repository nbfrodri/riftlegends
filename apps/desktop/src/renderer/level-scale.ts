// One color scale for player levels (attributes and rating), shared by the
// player card (#360) and the market (#384). High is green, low is red; the
// level is also read out, never only colored.

export type Level = "high" | "mid" | "low";

export function levelOf(value: number): Level {
	return value >= 75 ? "high" : value <= 45 ? "low" : "mid";
}

export const levelColor = {
	high: "text-good",
	mid: "",
	low: "text-bad",
} as const satisfies Record<Level, string>;
