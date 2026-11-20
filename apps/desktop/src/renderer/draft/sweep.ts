import { animate } from "motion";
import { Container, Graphics, WebGLRenderer } from "pixi.js";
// Precompiled uniform setters for the shell's script-src 'self'.
import "pixi.js/unsafe-eval";
import { pacing } from "./pacing";

export async function createSweep(canvas: HTMLCanvasElement) {
	const context = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
	});
	if (!context) throw new Error("WebGL2 unavailable");
	const renderer = new WebGLRenderer();
	await renderer.init({
		canvas,
		context,
		backgroundAlpha: 0,
		width: 600,
		height: 320,
	});
	const stage = new Container();
	const stripe = new Graphics();
	for (let band = 0; band < 24; band++) {
		const x = band * 3;
		stripe.poly([x + 112, 0, x + 116, 0, x + 4, 320, x, 320]).fill({
			color: 0xb9deff,
			alpha: (1 - Math.abs((band - 11.5) / 12)) * 0.64,
		});
	}
	stage.addChild(stripe);
	stripe.x = -200;
	renderer.render(stage);
	let animation: { stop(): void } | undefined;
	return {
		play() {
			animation?.stop();
			animation = animate(-200, 600, {
				duration: pacing.sweepMs / 1000,
				ease: pacing.ease,
				onUpdate(x) {
					stripe.x = x;
					renderer.render(stage);
				},
			});
		},
		destroy() {
			animation?.stop();
			stage.destroy({ children: true });
			renderer.destroy();
		},
	};
}
