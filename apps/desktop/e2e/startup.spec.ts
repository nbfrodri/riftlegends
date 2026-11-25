import { expect } from "./fixtures";
import { test } from "./startup-fixtures";
import { installTestCache } from "./test-cache";

test("waits for the installed real catalog before opening the landing screen", async ({
	startup,
}) => {
	const { page, profile, release } = startup;
	for (const [width, height] of [
		[1280, 720],
		[1366, 768],
	] as const) {
		await page.setViewportSize({ width, height });
		await expect(page.getByRole("progressbar")).toBeInViewport({ ratio: 1 });
		await expect(page.getByRole("navigation")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Start series" }),
		).toHaveCount(0);
	}
	await installTestCache(profile);
	await release();
	await expect(
		page.getByRole("heading", { name: "Set up series" }),
	).toBeVisible({ timeout: 15000 });
	await expect(
		page.getByRole("button", { name: "Start series" }),
	).toBeEnabled();
	await expect(page.getByRole("radio", { name: "Fictional" })).toHaveCount(0);
});

test("keeps an offline first launch on the retry screen", async ({
	startup,
}) => {
	await startup.release();
	await expect(startup.page.getByText(/Connect once/)).toBeVisible();
	await startup.page.getByRole("button", { name: "Retry" }).click();
	await expect(
		startup.page.getByRole("button", { name: "Retry" }),
	).toBeVisible();
	await expect(startup.page.getByRole("navigation")).toHaveCount(0);
});
