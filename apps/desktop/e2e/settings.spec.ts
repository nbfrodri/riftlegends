import { expect, launchApp, test } from "./fixtures";

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
		await page.getByRole("combobox", { name: "Language" }).click();
		await page.getByRole("option", { name: "Español" }).click();
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
