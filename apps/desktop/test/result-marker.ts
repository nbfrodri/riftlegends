import { expect } from "vitest";
import { resultStyle } from "../src/renderer/competition/series-result";

/**
 * One shared winner marker in every series card (#487): the winner's row has
 * the action bar and full text, its score in the action colour, and the
 * loser's row and score are dimmed.
 */
export function expectWinnerMarker(card: HTMLElement) {
	const won = card.querySelector<HTMLElement>('[data-result="won"]');
	const lost = card.querySelector<HTMLElement>('[data-result="lost"]');
	const classes = (element: Element | null | undefined) =>
		element?.className.split(/\s+/) ?? [];
	expect(classes(won)).toEqual(
		expect.arrayContaining(resultStyle("won").row.split(" ")),
	);
	expect(classes(won?.querySelector("[data-score]"))).toEqual(
		expect.arrayContaining(resultStyle("won").score.split(" ")),
	);
	expect(classes(lost)).toEqual(
		expect.arrayContaining(resultStyle("lost").row.split(" ")),
	);
	expect(classes(lost?.querySelector("[data-score]"))).toEqual(
		expect.arrayContaining(resultStyle("lost").score.split(" ")),
	);
}
