import type { ElectronApplication, Page } from "@playwright/test";
import type { SeriesOptions } from "@rift-legends/contracts";
import type { CoreBridge } from "../src/main/core-bridge";
import { expect, test } from "./fixtures";
import { flagBaselineOffset } from "./flag-baseline";
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

/** #366: no name, champion or badge in the stats table is cut short. */
async function expectNoTruncation(page: Page) {
	const cut = await page
		.getByRole("table", { name: /^Estadísticas/ })
		.evaluate((table) =>
			[...table.querySelectorAll("td, th, td *, th *")]
				// Visually hidden labels are clipped on purpose.
				.filter((el) => !el.closest(".sr-only"))
				.filter((el) => el.scrollWidth > el.clientWidth + 1)
				.map((el) => `${el.tagName}:${el.textContent}`),
		);
	expect(cut).toEqual([]);
}

/** Narrowest room left between two columns' contents, in pixels (#534). */
const MIN_COLUMN_GAP = 12;

/**
 * #534: the figures sit centred under their centred headers, and neighbouring
 * columns keep at least {@link MIN_COLUMN_GAP} between their contents.
 */
async function expectCenteredColumns(page: Page) {
	const { offCentre, gaps } = await page
		.getByRole("table", { name: /^Estadísticas/ })
		.evaluate((table) => {
			// The visible ink of a cell: its text, pictures and badges, not hidden labels.
			const box = (cell: Element) => {
				const rects: DOMRect[] = [];
				const walker = document.createTreeWalker(cell, NodeFilter.SHOW_ALL);
				for (let node = walker.nextNode(); node; node = walker.nextNode()) {
					const element = node instanceof Element ? node : node.parentElement;
					if (element?.closest(".sr-only")) continue;
					if (node instanceof Text && node.data.trim()) {
						const range = document.createRange();
						range.selectNodeContents(node);
						rects.push(range.getBoundingClientRect());
					} else if (
						node instanceof SVGSVGElement ||
						node instanceof HTMLImageElement ||
						(node instanceof HTMLElement && node.matches("[role=img]"))
					)
						rects.push(node.getBoundingClientRect());
				}
				const left = Math.min(...rects.map((r) => r.left));
				const right = Math.max(...rects.map((r) => r.right));
				return { left, right, x: left, width: right - left };
			};
			const rows = [...table.querySelectorAll("tr")].map((row) =>
				[...row.children].map(box),
			);
			const [header = [], ...body] = rows;
			const offCentre: string[] = [];
			for (const [r, row] of body.entries())
				for (let c = 2; c < row.length; c++) {
					const cell = row[c];
					const head = header[c];
					if (!cell || !head) continue;
					const diff = cell.x + cell.width / 2 - (head.x + head.width / 2);
					if (Math.abs(diff) > 1)
						offCentre.push(`row ${r} col ${c}: ${diff.toFixed(1)}`);
				}
			const gaps = header.slice(1).map((_, c) =>
				Math.min(
					...rows.map((row) => {
						const left = row[c];
						const right = row[c + 1];
						return left && right ? right.left - left.right : Infinity;
					}),
				),
			);
			return { offCentre, gaps: gaps.map((gap) => Math.round(gap * 10) / 10) };
		});
	console.log(`column gaps at ${page.viewportSize()?.width}px`, gaps.join(" "));
	expect(offCentre).toEqual([]);
	expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_COLUMN_GAP);
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
					await expectNoTruncation(appWindow);
					await expectCenteredColumns(appWindow);
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
			// #443: the MVP's flag stands on the baseline of the big name.
			const mvp = appWindow
				.getByRole("region", { name: "MVP de la serie" })
				.getByRole("heading", { level: 2 });
			expect(Math.abs(await flagBaselineOffset(mvp))).toBeLessThanOrEqual(1.5);
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
					await expectNoTruncation(appWindow);
					await expectCenteredColumns(appWindow);
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
