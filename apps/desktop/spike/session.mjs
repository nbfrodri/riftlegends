import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron } from "@playwright/test";

export async function session(dir, width, height, run) {
	await using profile = await mkdtempDisposable(
		join(tmpdir(), "rift-s1-profile-"),
	);
	const app = await _electron.launch({
		chromiumSandbox: true,
		args: [
			".",
			"--ozone-platform=wayland",
			"--lang=es-ES",
			`--user-data-dir=${profile.path}`,
		],
		env: { ...process.env, RIFT_S1_VIEWPORT: `${width}x${height}` },
	});
	try {
		const page = await app.firstWindow();
		page.on("pageerror", (error) => console.error(error));
		page.on("console", (msg) => {
			if (msg.type() === "error") console.error(msg.text());
		});
		await page
			.locator('canvas[data-renderer="webgl2"]')
			.waitFor({ state: "attached", timeout: 15000 });
		await page.evaluate(() => document.fonts.ready.then(() => true));
		const clients = JSON.parse(
			execFileSync("hyprctl", ["clients", "-j"], { encoding: "utf8" }),
		);
		const client = clients.find((c) => c.pid === app.process().pid);
		assert.ok(client && !client.xwayland, "Expected native Hyprland client");
		const monitors = JSON.parse(
			execFileSync("hyprctl", ["monitors", "-j"], { encoding: "utf8" }),
		);
		const monitor = monitors.find((m) => m.id === client.monitor);
		assert.ok(
			Math.abs(monitor.refreshRate - 60) < 1,
			"Expected physical 60 Hz display",
		);
		const info = await page.evaluate(() => {
			const gl = document.querySelector("canvas").getContext("webgl2");
			const debug = gl.getExtension("WEBGL_debug_renderer_info");
			return {
				renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
				version: gl.getParameter(gl.VERSION),
				width: innerWidth,
				height: innerHeight,
				dpr: devicePixelRatio,
			};
		});
		const hardware = await app.evaluate(({ app }) => ({
			versions: process.versions,
			gpu: app.getGPUFeatureStatus(),
		}));
		console.log({
			info,
			size: client.size,
			xwayland: client.xwayland,
			refresh: monitor.refreshRate,
		});
		assert.deepEqual([info.width, info.height], [width, height]);
		assert.match(info.version, /^WebGL 2\.0/);
		assert.doesNotMatch(info.renderer, /swiftshader|llvmpipe|software/i);
		return await run(
			page,
			{
				...info,
				...hardware,
				monitor: monitor.name,
				refresh: monitor.refreshRate,
				xwayland: client.xwayland,
			},
			dir,
		);
	} finally {
		await app.close();
	}
}
