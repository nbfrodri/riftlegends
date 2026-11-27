// One winner marker for every series card (#487): bracket, Swiss and
// calendar. The winner's row keeps the full text colour in bold with a 2 px
// bar of the action colour on its left edge, as the sidebar marks its current
// item, and its score in the action colour; the loser's row and score are
// dimmed. Screen readers read the result from the series label.

export type SeriesResult = "won" | "lost" | undefined;

export function resultStyle(result: SeriesResult) {
	if (result === "won")
		return {
			row: "font-semibold text-text shadow-[inset_2px_0_0_var(--color-action)]",
			score: "text-action",
		};
	if (result === "lost")
		return { row: "text-muted/75", score: "text-muted/75" };
	return { row: "", score: "" };
}
