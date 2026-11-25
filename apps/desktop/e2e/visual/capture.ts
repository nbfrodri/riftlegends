import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures";

const cajaFonts = [
	...[400, 500, 550, 600, 700].map(
		(weight) => `${weight} 16px "Archivo Variable"`,
	),
	'700 16px "Unbounded Variable"',
];

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
	// A window that has not painted yet can refuse the capture; wait two frames
	// and retry only this throwaway shot, never the assertion.
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

export async function captureScreen(
	page: Page,
	name: string,
	target: Page | Locator = page,
) {
	await waitForCaptureAssets(page);
	await expect(target).toHaveScreenshot(name);
}
