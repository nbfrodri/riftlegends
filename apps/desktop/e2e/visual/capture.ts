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
}

export async function captureScreen(
	page: Page,
	name: string,
	target: Page | Locator = page,
) {
	await waitForCaptureAssets(page);
	await expect(target).toHaveScreenshot(name);
}
