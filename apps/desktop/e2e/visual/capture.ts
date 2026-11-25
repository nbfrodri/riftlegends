import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures";

const cajaFonts = [
	...[400, 500, 550, 600, 700].map(
		(weight) => `${weight} 16px "Archivo Variable"`,
	),
	'700 16px "Unbounded Variable"',
];

// Chromium repaints only what was invalidated and keeps the rest of the old
// raster, so consecutive screenshots of the same page flip between frames whose
// rounded corners differ by one level (tiles sit at fractional positions) and
// two runs of the same commit saved different PNGs (#501). Hiding and showing
// the body drops every paint chunk; the frame that follows is the same in every
// run. Scroll offsets and focus do not survive display:none, so put them back.
async function repaintFromScratch(page: Page) {
	await page.evaluate(() => {
		const scrolled = [
			document.documentElement,
			...document.body.querySelectorAll("*"),
		]
			.filter((element) => element.scrollTop > 0 || element.scrollLeft > 0)
			.map((element) => ({
				element,
				top: element.scrollTop,
				left: element.scrollLeft,
			}));
		const focused = document.activeElement;
		document.body.style.display = "none";
		void document.body.offsetHeight;
		document.body.style.display = "";
		for (const { element, top, left } of scrolled) element.scrollTo(left, top);
		if (focused instanceof HTMLElement && focused !== document.body)
			focused.focus({ preventScroll: true });
	});
}

export async function waitForCaptureAssets(page: Page) {
	await page.evaluate(async (fonts) => {
		const sample = "Ajustes 0123 áéíóúñ ·";
		const faces = await Promise.all(
			fonts.map((font) => document.fonts.load(font, sample)),
		);
		// SVG icons are inline. Decode the raster images and SVGs served as <img>.
		await Promise.all(Array.from(document.images, (image) => image.decode()));
		await document.fonts.ready;
		for (const [index, font] of fonts.entries()) {
			// check() can return true when the CSS face is missing entirely.
			if (!faces[index]?.length || !document.fonts.check(font, sample)) {
				throw new Error(`Caja font is unavailable: ${font}`);
			}
		}
	}, cajaFonts);
	await repaintFromScratch(page);
	// The first screenshot of a cold app takes over a second on CI (software
	// rendering). Take it now, outside the assertion, so toHaveScreenshot's
	// stability loop compares fast frames instead of timing out (#317).
	// A window that has not painted yet can refuse the capture; wait two frames
	// and retry only this throwaway shot, never the assertion.
	await page.evaluate(
		() =>
			new Promise<void>((done) =>
				requestAnimationFrame(() => requestAnimationFrame(() => done())),
			),
	);
	// Then wait for the page to settle byte for byte: toHaveScreenshot's own
	// stability check tolerates maxDiffPixelRatio, so it accepts a frame that
	// still has anti-aliasing 1 level off at a rounded corner (#501).
	let previous: Buffer | undefined;
	for (let attempt = 1; ; attempt++) {
		try {
			const frame = await page.screenshot({
				animations: "disabled",
				caret: "hide",
			});
			if (previous?.equals(frame)) return;
			previous = frame;
		} catch (error) {
			if (attempt === 5) throw error;
		}
		if (attempt === 20) throw new Error("The window never settled");
		await page.waitForTimeout(250);
	}
}

// Under Xvfb the OS pointer stays mid-screen, and after a repaint Chromium
// re-applies :hover from it, so a button under that spot was hovered in some
// runs only (#501). While capturing, no element receives the pointer: hover
// stays off in every run. Playwright's own clicks need it back afterwards.
async function withoutPointer<T>(
	page: Page,
	run: () => Promise<T>,
): Promise<T> {
	// A constructed stylesheet: the app's CSP refuses inline <style>.
	await page.evaluate(() => {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(
			"*, *::before, *::after { pointer-events: none !important; }",
		);
		Object.assign(window, { __noPointer: sheet });
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
	});
	try {
		return await run();
	} finally {
		await page.evaluate(() => {
			const sheet = (window as unknown as { __noPointer: CSSStyleSheet })
				.__noPointer;
			document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
				(each) => each !== sheet,
			);
		});
	}
}

export function captureScreen(
	page: Page,
	name: string,
	target: Page | Locator = page,
) {
	return withoutPointer(page, () => captureHovered(page, name, target));
}

/** Captures with the pointer as it is, for a screen that shows a hover (tooltip). */
export async function captureHovered(
	page: Page,
	name: string,
	target: Page | Locator = page,
) {
	await waitForCaptureAssets(page);
	await expect(target).toHaveScreenshot(name);
}
