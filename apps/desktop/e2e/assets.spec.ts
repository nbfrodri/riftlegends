import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "./fixtures";

const pixel = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
	"base64",
);

test("the renderer can load an active cached image and cannot load outside the cache", async ({
	appWindow,
}, testInfo) => {
	const profile = testInfo.outputPath("profile");
	const source = join(profile, "assets", "ddragon");
	const active = join(source, "1.2.3");
	await mkdir(active, { recursive: true });
	await writeFile(join(active, "pixel.png"), pixel);
	await writeFile(join(profile, "outside.png"), pixel);
	await writeFile(join(source, "current.json"), '{"version":"1.2.3"}');
	await symlink(profile, join(active, "linked"), "junction");

	const loadWidth = (path: string) =>
		appWindow.evaluate(async (url) => {
			const image = new Image();
			image.src = url;
			try {
				await image.decode();
				return image.naturalWidth;
			} catch {
				return 0;
			}
		}, `rift-asset://ddragon/${path}`);

	expect(await loadWidth("pixel.png")).toBe(1);
	expect(await loadWidth("../../../outside.png")).toBe(0);
	expect(await loadWidth("%2e%2e%2f%2e%2e%2f%2e%2e%2foutside.png")).toBe(0);
	expect(await loadWidth("linked/outside.png")).toBe(0);
});

test("the renderer can query cache status and receive sync progress", async ({
	appWindow,
}) => {
	await expect
		.poll(() => appWindow.evaluate(() => window.riftlegends.assets.status()))
		.toEqual({ state: "missing" });
	expect(
		await appWindow.evaluate(async () => {
			const assets = window.riftlegends.assets;
			const progress: unknown[] = [];
			const unsubscribe = assets.subscribe((event) => progress.push(event));
			const result = await assets.sync();
			unsubscribe();
			return { progress, result };
		}),
	).toEqual({
		progress: [{ completed: 0, total: 0 }],
		result: { state: "missing" },
	});
});
