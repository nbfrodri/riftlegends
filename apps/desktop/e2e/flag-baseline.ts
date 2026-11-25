import type { Locator } from "@playwright/test";

/**
 * How far the bottom of the flag in a heading sits from the baseline of the
 * heading's text, in pixels (0 when the flag stands on the baseline). The
 * flag must be the only image in the heading.
 */
export async function flagBaselineOffset(heading: Locator) {
	const flag = await heading.getByRole("img").boundingBox();
	const baseline = await heading.evaluate(async (el) => {
		await document.fonts.ready;
		const text = [...el.childNodes].find(
			(node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
		);
		const context = document.createElement("canvas").getContext("2d");
		if (!text || !context) return Number.NaN;
		const style = getComputedStyle(el);
		context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
		const metrics = context.measureText(text.textContent ?? "");
		const range = document.createRange();
		range.selectNodeContents(text);
		const box = range.getBoundingClientRect();
		const contentArea =
			metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
		return (
			box.top + (box.height - contentArea) / 2 + metrics.fontBoundingBoxAscent
		);
	});
	return flag ? flag.y + flag.height - baseline : Number.NaN;
}
