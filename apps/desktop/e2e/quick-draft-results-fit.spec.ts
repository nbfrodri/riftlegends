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
	await playQuickDraftBo5(
		electronApp,
		appWindow,
		async (screen) => {
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
				for (const size of [
					{ width: 1280, height: 720 },
					{ width: 1366, height: 768 },
				]) {
					await appWindow.setViewportSize(size);
					await expectToFit(appWindow);
					// #380: the right column spans exactly the stats table's height.
					const edges = await appWindow.evaluate(() => {
						const heading = [...document.querySelectorAll("h2")].find((h) =>
							/disputas decisivas/i.test(h.textContent ?? ""),
						);
						const column = heading?.closest("section")?.parentElement;
						const stats = column?.previousElementSibling;
						if (!column || !stats) return null;
						const a = stats.getBoundingClientRect();
						const b = column.getBoundingClientRect();
						const last = column.lastElementChild?.getBoundingClientRect();
						return {
							top: Math.round(a.top - b.top),
							bottom: Math.round(a.bottom - b.bottom),
							lastBottom: Math.round((last?.bottom ?? 0) - b.bottom),
						};
					});
					expect(edges).toEqual({ top: 0, bottom: 0, lastBottom: 0 });
				}
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
		},
		async () => {
			for (const size of [
				{ width: 1280, height: 720 },
				{ width: 1366, height: 768 },
			]) {
				await appWindow.setViewportSize(size);
				await expectToFit(appWindow);
			}
		},
	);
	expect(checked).toBe(4);
});
