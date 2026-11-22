import { expect, launchApp, test } from "./fixtures";

test("T9: opens a new window while the previous process is still quitting", async ({
	playwright,
	systemLocale,
}, testInfo) => {
	const options = { profileDir: testInfo.outputPath("profile"), systemLocale };
	const first = await launchApp({ playwright }, options);
	try {
		await first.firstWindow();
		await first.evaluate(({ app, BrowserWindow }) => {
			app.once("before-quit", (event) => event.preventDefault());
			BrowserWindow.getAllWindows()[0]?.close();
		});
		await expect
			.poll(() =>
				first.evaluate(
					({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
				),
			)
			.toBe(0);
		const second = await launchApp({ playwright }, options);
		try {
			const page = await second.firstWindow({ timeout: 5_000 });
			await expect(page.locator("html")).toHaveAttribute("lang", "en");
		} finally {
			await second.close();
		}
	} finally {
		await first.close();
	}
});

test("T9: the language choice survives a relaunch and beats the system locale", async ({
	playwright,
	systemLocale,
}, testInfo) => {
	const profileDir = testInfo.outputPath("profile");

	const first = await launchApp({ playwright }, { profileDir, systemLocale });
	try {
		const page = await first.firstWindow();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await page
			.getByRole("navigation", { name: "Club sections" })
			.getByRole("button", { name: "Settings" })
			.click();
		const language = page.getByRole("combobox", { name: "Language" });
		await language.press("Enter");
		await expect(page.getByRole("option", { name: "English" })).toBeFocused();
		await page.keyboard.press("ArrowUp");
		const spanish = page.getByRole("option", { name: "Español" });
		await expect(spanish).toBeFocused();
		await expect(spanish).toHaveCSS("outline-style", "solid");
		await expect(spanish).toHaveCSS("outline-color", "rgb(168, 222, 255)");
		await expect
			.poll(() =>
				spanish.evaluate((option) =>
					Number.parseFloat(getComputedStyle(option).outlineWidth),
				),
			)
			.toBeGreaterThanOrEqual(1);
		await page.keyboard.press("Enter");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajustes");
		await expect(page.locator("html")).toHaveAttribute("lang", "es");
	} finally {
		await first.close();
	}

	// Same profile, English system: the stored choice must win.
	const second = await launchApp({ playwright }, { profileDir, systemLocale });
	try {
		const page = await second.firstWindow();
		await expect(page.locator("html")).toHaveAttribute("lang", "es");
		await expect(
			page
				.getByRole("navigation", { name: "Secciones del club" })
				.getByRole("button", { name: "Mercado" }),
		).toBeVisible();
	} finally {
		await second.close();
	}
});
