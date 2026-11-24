import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { response, statIcons, svg, useCacheFixture } from "./cache-test-kit";
import { serveAsset } from "./protocol";

describe("main asset cache stat icons", () => {
	const t = useCacheFixture();
	const { create, source } = t;

	it("serves each stat icon from its fixed CommunityDragon SVG", async () => {
		const images = new Map(
			Object.entries(statIcons).map(([stat, path]) => [
				`https://raw.communitydragon.org/latest/${path}`,
				svg(stat),
			]),
		);
		t.override = async (url) => {
			const bytes = images.get(url.href);
			return bytes === undefined ? undefined : response(bytes);
		};
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		for (const stat of Object.keys(statIcons)) {
			const image = await serveAsset(t.profile, {
				method: "GET",
				url: `rift-asset://cdragon/stats/${stat}.svg`,
			});
			expect(image.status).toBe(200);
			expect(image.headers.get("content-type")).toBe("image/svg+xml");
			expect(await image.text()).toBe(svg(stat));
		}
	});

	it("rejects a stat icon that is not an SVG image", async () => {
		t.override = async (url) =>
			url.pathname === `/latest/${statIcons.gold}`
				? response("<html>not found</html>")
				: undefined;
		expect(await create().sync()).toMatchObject({ state: "error" });
		await expect(readFile(source("current.json"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
