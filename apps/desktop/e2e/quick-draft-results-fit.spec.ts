import type { ElectronApplication, Page } from "@playwright/test";
import type { SeriesOptions } from "@rift-legends/contracts";
import type { CoreBridge } from "../src/main/core-bridge";
import { expect, test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CORE: "1" } });

declare const riftCore: CoreBridge;

const sizes = [
	{ width: 1280, height: 720 },
	{ width: 1366, height: 768 },
];
const championNames = [
	"Aurelion Sol",
	"Heimerdinger",
	"Kog'Maw",
	"Tahm Kench",
	"Nunu & Willump",
];

/** Rename the displayed options while the real core plays the same fictional series. */
async function useLongNames(app: ElectronApplication) {
	await app.evaluate((_, names) => {
		const { query } = riftCore;
		riftCore.query = async (body) => {
			const result = await query(body);
			if (
				!result.ok ||
				!("view" in result) ||
				JSON.parse(body).kind !== "series.options"
			)
				return result;
			const options = result.view as SeriesOptions;
			return {
				...result,
				view: {
					...options,
					champions: options.champions.map((champion, i) => ({
						...champion,
						name: names[i % names.length],
					})),
					teams: options.teams.map((team) => ({
						...team,
						players: team.players.map((player, i) => ({
							...player,
							handle: `Thundershield${i + 1}`,
						})),
					})),
				},
			};
		};
	}, championNames);
}

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

/** #507: the five mirrored rows of the differences by role, whole and unclipped. */
async function expectGapsToFit(page: Page, seen: Set<string>) {
	const gaps = page.getByRole("table", { name: "Diferencias por rol" });
	await expect(gaps.locator("tr[data-role]")).toHaveCount(5);
	await expect(gaps).toBeInViewport({ ratio: 1 });
	const clipped = await gaps.evaluate((table) => {
		const section = table.closest("section");
		return section ? section.scrollHeight - section.clientHeight : -1;
	});
	expect(clipped).toBe(0);
	const names = gaps.locator("tr[data-role] [data-tooltip-heading] > span");
	await expect(names).toHaveCount(20);
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	const measurements = await names.evaluateAll((elements) =>
		elements.map(({ textContent, scrollWidth, clientWidth }) => ({
			textContent,
			scrollWidth,
			clientWidth,
		})),
	);
	for (const { textContent } of measurements)
		if (textContent) seen.add(textContent);
	expect(
		measurements.filter(
			({ scrollWidth, clientWidth }) => scrollWidth > clientWidth,
		),
		`clipped role-gap names at ${page.viewportSize()?.width}px`,
	).toEqual([]);
}

test("#259 #310 #524: the setup, match and results fit the supported test sizes", async ({
	electronApp,
	appWindow,
}) => {
	test.setTimeout(240_000);
	await useLongNames(electronApp);
	await appWindow.reload();
	const seen = new Set<string>();
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
				for (const size of sizes) {
					await appWindow.setViewportSize(size);
					await expectToFit(appWindow);
					await expectGapsToFit(appWindow, seen);
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
			for (const size of sizes) {
				await appWindow.setViewportSize(size);
				await expectToFit(appWindow);
				await expectGapsToFit(appWindow, seen);
			}
			const maps = appWindow.getByRole("tab", { name: /^Mapa \d$/ });
			for (const map of await maps.all()) {
				await map.click();
				await expect(map).toHaveAttribute("aria-selected", "true");
				for (const size of sizes) {
					await appWindow.setViewportSize(size);
					await expectToFit(appWindow);
					await expectGapsToFit(appWindow, seen);
				}
			}
			checked++;
		},
		async () => {
			for (const size of sizes) {
				await appWindow.setViewportSize(size);
				await expectToFit(appWindow);
			}
		},
	);
	expect(checked).toBe(4);
	expect([...seen]).toEqual(expect.arrayContaining(championNames));
});
