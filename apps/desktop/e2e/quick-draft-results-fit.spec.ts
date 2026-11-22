import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CORE: "1" } });

/** How far the window and the main area scroll; zero when everything fits. */
const overflow = (page: Page) =>
	page.evaluate(() => {
		const main = document.querySelector("main");
		return {
			page: document.documentElement.scrollHeight - innerHeight,
			main: main ? main.scrollHeight - main.clientHeight : 0,
		};
	});

async function expectToFit(page: Page) {
	expect(await overflow(page)).toEqual({ page: 0, main: 0 });
}

test("#259 #310: the setup, match and results fit the default window", async ({
	electronApp,
	appWindow,
}) => {
	test.setTimeout(240_000);
	// The default window size; the compositor may tile the window otherwise.
	await appWindow.setViewportSize({ width: 1366, height: 768 });
	let checked = 0;
	await playQuickDraftBo5(electronApp, appWindow, async (screen) => {
		if (screen === "setup") {
			await expectToFit(appWindow);
			checked++;
		}
		if (screen === "match") {
			await expectToFit(appWindow);
			for (const team of ["Forge", "Shoal"])
				await expect(
					appWindow.getByRole("region", {
						name: `${team} · estructuras y objetivos`,
					}),
				).toBeInViewport({ ratio: 1 });
			checked++;
		}
		if (screen === "game-result") {
			await expectToFit(appWindow);
			checked++;
		}
		if (screen !== "series-result") return;
		await expectToFit(appWindow);
		const maps = appWindow.getByRole("tab", { name: /^Mapa \d$/ });
		for (const map of await maps.all()) {
			await map.click();
			await expect(map).toHaveAttribute("aria-selected", "true");
			await expectToFit(appWindow);
		}
		checked++;
	});
	expect(checked).toBe(4);
});
