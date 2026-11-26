import type { competitionViews } from "@rift-legends/contracts";

// The words of the team page (plan 31, U8): results said in full, for the
// tooltip and screen readers, and times as minutes and seconds.

export type TeamProfile = ReturnType<typeof competitionViews.teamProfile.parse>;
export type TeamSeries = TeamProfile["series"][number];

type Translate = (
	key: "competition.team.result.won" | "competition.team.result.lost",
	options: { a: number; b: number; team: string },
) => string;

/** «Won 2–1 against Shoal». */
export const resultText = (
	t: Translate,
	series: TeamSeries,
	teamName: (id: string) => string,
) =>
	t(`competition.team.result.${series.won ? "won" : "lost"}`, {
		a: series.score[0],
		b: series.score[1],
		team: teamName(series.opponent),
	});

/** Seconds as «31:05». */
export function minutes(seconds: number) {
	const rest = seconds % 60;
	return `${Math.floor(seconds / 60)}:${String(rest).padStart(2, "0")}`;
}
