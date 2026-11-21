import { Graphics, WebGLRenderer } from "pixi.js";
// Precompiled uniform setters for Electron's script-src 'self'.
import "pixi.js/unsafe-eval";

/** Draw the transparent light once. Motion moves its layer on the compositor. */
export async function drawSweep(canvas: HTMLCanvasElement) {
	const context = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
	});
	if (!context) return;
	const renderer = new WebGLRenderer();
	await renderer.init({
		canvas,
		context,
		backgroundAlpha: 0,
		width: 96,
		height: 64,
	});
	const stripe = new Graphics();
	for (let band = 0; band < 24; band++) {
		const x = band * 3;
		stripe.poly([x + 22, 0, x + 25, 0, x + 3, 64, x, 64]).fill({
			color: 0xb9deff,
			alpha: (1 - Math.abs((band - 11.5) / 12)) * 0.64,
		});
	}
	renderer.render(stripe);
	return () => {
		stripe.destroy();
		renderer.destroy();
	};
}
