import type { Locator, Page } from "@playwright/test";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { expect, launchApp, test } from "./fixtures";

interface Sample {
	latency: number;
	intervals: number[];
	animations: Array<{ delay: number; duration: number | string }>;
	/** WebGL renderer of the lock sweep, read while the lock is on screen. */
	renderer: string;
}

declare global {
	interface Window {
		draftSample: Promise<Sample>;
	}
}

// S1: start at real pointer input and allow one more frame after the visible
// champion changes. Sample frame intervals only during the two motion windows.
async function measure(confirm: Locator, champion: string) {
	await confirm.evaluate(
		(button, { champion, pacing }) => {
			window.draftSample = new Promise((resolve) => {
				button.addEventListener(
					"pointerdown",
					(event) => {
						const intervals: number[] = [];
						const animations: Sample["animations"] = [];
						let first: number | undefined;
						let previous = 0;
						let latency = 0;
						const frame = (now: number) => {
							if (first !== undefined) {
								const from = previous - first;
								const to = now - first;
								if (previous === first) {
									latency = performance.now() - event.timeStamp;
									const scene = document.querySelector("[data-draft-lock]");
									for (const animation of scene?.getAnimations({
										subtree: true,
									}) ?? []) {
										const timing = animation.effect?.getComputedTiming();
										if (timing && typeof timing.duration === "number")
											animations.push({
												delay: timing.delay ?? 0,
												duration: timing.duration,
											});
									}
								}
								if (
									from < pacing.sweepMs ||
									(to >= pacing.captionDelayMs &&
										from < pacing.captionDelayMs + pacing.captionEnterMs)
								)
									intervals.push(now - previous);
								if (to >= pacing.captionDelayMs + pacing.captionEnterMs) {
									const canvas = document.querySelector<HTMLCanvasElement>(
										"[data-draft-lock] canvas",
									);
									const gl = canvas?.getContext("webgl2");
									let renderer = "unavailable";
									if (gl) {
										// A transparent clear alone is not the Pixi sweep. Sample its bright centre.
										const pixel = new Uint8Array(4);
										gl.readPixels(
											46,
											32,
											1,
											1,
											gl.RGBA,
											gl.UNSIGNED_BYTE,
											pixel,
										);
										const debug = gl.getExtension("WEBGL_debug_renderer_info");
										renderer = !pixel[3]
											? "blank"
											: debug
												? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
												: "unavailable";
									}
									resolve({ latency, intervals, animations, renderer });
									return;
								}
							} else if (
								document.querySelector("[data-draft-lock] strong")
									?.textContent === champion
							) {
								first = now;
							}
							previous = now;
							requestAnimationFrame(frame);
						};
						requestAnimationFrame(frame);
					},
					{ once: true },
				);
			});
		},
		{ champion, pacing },
	);
	await confirm.click();
	return confirm.page().evaluate(() => window.draftSample);
}

const p95 = (values: number[]) =>
	values.sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] as number;

async function playDraft(page: Page) {
	await page.getByRole("combobox", { name: "My team" }).click();
	await page.getByRole("option", { name: "Shoal" }).click();
	await page.getByRole("button", { name: "Start series" }).click();
	await page.getByRole("button", { name: "Confirm choice" }).click();
	await page.getByRole("button", { name: "Go to draft" }).click();
	const grid = page.getByRole("group", { name: "Champions" });
	const samples: Sample[] = [];
	for (let turn = 0; turn < 10; turn++) {
		await expect(
			page.getByRole("heading", { name: "Choose a champion" }),
		).toBeVisible();
		const tile = grid.getByRole("button", { disabled: false }).first();
		const champion = await tile.getAttribute("aria-label");
		if (!champion) throw new Error("The selected tile needs a champion name");
		await tile.click();
		samples.push(
			await measure(
				page.getByRole("button", { name: /^Confirm (ban|pick)$/ }),
				champion,
			),
		);
	}
	await expect(
		page.getByRole("button", { name: "Confirm lineup" }),
	).toBeEnabled();
	return samples;
}

test("plays from setup through the AI's side, bans, picks and roles within the S1 budget", async ({
	playwright,
}, info) => {
	test.setTimeout(120_000);
	// Keep screenshots and tracing out of the frame measurements, as in S1.
	const app = await launchApp(
		{ playwright },
		{ profileDir: info.outputPath("profile"), systemLocale: "en-US" },
	);
	try {
		const page = await app.firstWindow();
		await page.setViewportSize({ width: 1366, height: 768 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		const runs = [];
		for (let draft = 0; draft < 3; draft++) {
			if (draft > 0) {
				await page.getByRole("button", { name: "Market", exact: true }).click();
				await page.getByRole("button", { name: "Draft", exact: true }).click();
			}
			runs.push(await playDraft(page));
		}
		// Five warm-ups as in S1. With 25 measured inputs, nearest-rank p95
		// describes the tail independently of the single slowest confirmation.
		const samples = runs.flat().slice(5);
		await info.attach("draft-frames.json", {
			body: JSON.stringify(runs),
			contentType: "application/json",
		});
		const frames = samples.flatMap((sample) => sample.intervals);
		const latency = p95(samples.map((sample) => sample.latency));
		const fps = (1000 * frames.length) / frames.reduce((a, b) => a + b, 0);
		const interval = p95(frames);
		// Roles hides the lock (#432), so each sample reads the renderer in-page.
		const renderer = samples.at(-1)?.renderer ?? "unavailable";
		expect(renderer).not.toBe("blank");
		console.log(
			`S1 (${samples.length} confirmations, ${frames.length} intervals): p95 ${latency.toFixed(1)} ms, ${fps.toFixed(2)} FPS, frame p95 ${interval.toFixed(1)} ms. ${renderer}`,
		);
		expect(latency).toBeLessThanOrEqual(100);
		for (const sample of samples) {
			expect(sample.animations).toEqual(
				expect.arrayContaining([
					{ delay: 0, duration: pacing.sweepMs },
					{ delay: pacing.captionDelayMs, duration: pacing.captionEnterMs },
				]),
			);
		}
		// Hosted CI uses software rendering. ADR 0003 budgets GPU fluency on hardware.
		if (!/swiftshader|llvmpipe|software|unavailable/i.test(renderer)) {
			expect(fps).toBeGreaterThanOrEqual(55);
			expect(interval).toBeLessThanOrEqual(25);
		}
	} finally {
		await app.close();
	}
});
