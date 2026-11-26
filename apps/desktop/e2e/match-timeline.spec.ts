import type { Page } from "@playwright/test";
import type { DraftView } from "@rift-legends/contracts";
import type { CoreBridge } from "../src/main/core-bridge";
import { expect, launchApp, test } from "./fixtures";

declare const riftCore: CoreBridge;

// Until the entire draft is playable here, let the coach draft for both sides
// on the real bridge and play the user's own turns with the first legal move.
// The renderer then starts at the game plan screen.
function prepareDraft() {
	const { send, query } = riftCore;
	const draft = async (body: string) => {
		const start = JSON.parse(body);
		start.payload.ai = [null, "coach"];
		start.payload.seed = 7;
		const human = start.payload.teams[0];
		let result = await send(JSON.stringify(start));
		while (result.ok && "facts" in result) {
			const read = (await query(
				JSON.stringify({
					v: start.v,
					sessionId: start.sessionId,
					kind: "draft.view",
					params: {},
				}),
			)) as unknown as {
				ok: boolean;
				view: DraftView;
			};
			if (!read.ok) break;
			const view = read.view;
			if (view.phase === "result") return result;
			const turn = view.turn;
			let kind = "draft.ai";
			let payload: object = {};
			if (turn && turn.team === human) {
				if (turn.action === "side") {
					kind = "side.choose";
					payload = { team: human, choice: "blue" };
				} else if (turn.action === "ban") {
					kind = "draft.ban";
					payload = { team: human, champion: null };
				} else if (turn.action === "pick") {
					kind = "draft.pick";
					const free = view.availability.find((a) => a.status === "free");
					payload = { team: human, champion: free?.champion };
				} else {
					const picks = (view.blue.team === human ? view.blue : view.red).picks;
					const roles = ["top", "jungle", "mid", "bot", "support"];
					kind = "draft.roles";
					payload = {
						team: human,
						roles: Object.fromEntries(roles.map((r, i) => [r, picks[i]])),
					};
				}
			}
			result = await send(
				JSON.stringify({
					v: start.v,
					sessionId: start.sessionId,
					expectedPosition: result.position,
					kind,
					payload,
				}),
			);
		}
		throw new Error(JSON.stringify(result));
	};
	// Intermediate draft facts invalidate draft.view. Hold that read until
	// the seeded draft is complete so the UI starts at the match boundary.
	riftCore.send = async (body) => {
		riftCore.send = send;
		const seeded = draft(body);
		riftCore.query = async (request) => {
			await seeded;
			return query(request);
		};
		try {
			return await seeded;
		} finally {
			riftCore.query = query;
		}
	};
}

/** Both team panels are whole on screen. */
async function expectTeamPanelsInView(page: Page) {
	for (const team of ["Forge", "Shoal"])
		await expect(
			page.getByRole("region", { name: `Estructuras y objetivos de ${team}` }),
		).toBeInViewport({ ratio: 1 });
}

/**
 * #502: the face to face fits whole without page scroll, with 48 px photos,
 * 28 px champion badges, rows of 56 px or more, white names and K/D/A, and
 * the long handle set above never moves a column.
 */
async function expectBigFaceToFace(page: Page) {
	const faceToFace = page.getByRole("table", { name: "Cara a cara" });
	await expect(faceToFace).toBeInViewport({ ratio: 1 });
	const measure = await page.evaluate(() => {
		const table = document.querySelector("table[aria-label='Cara a cara']");
		if (!table) throw new Error("Missing face to face");
		const main = document.querySelector("main");
		const box = (el: Element | null) => el?.getBoundingClientRect();
		const text = getComputedStyle(document.body).color;
		const cells = [...table.querySelectorAll("[data-lane-player]")];
		return {
			scroll: Math.max(
				document.documentElement.scrollHeight - innerHeight,
				main ? main.scrollHeight - main.clientHeight : 0,
			),
			rows: [...table.querySelectorAll("tbody tr")].map(
				(row) => row.getBoundingClientRect().height,
			),
			photos: cells.map(
				(c) => box(c.querySelector("[data-part=photo] > *"))?.height ?? 0,
			),
			badges: cells.map(
				(c) =>
					box(c.querySelector("[data-part=champion] [role=img]"))?.height ?? 0,
			),
			names: cells.map((c) => {
				const handle = c.querySelector("[data-part=name] > span");
				return handle ? getComputedStyle(handle).color === text : false;
			}),
			// #510: the final vision score, only in the jungle and support rows.
			vision: [...table.querySelectorAll("tbody tr")].map(
				(row) => row.querySelectorAll("[data-vision]").length,
			),
			kda: [...table.querySelectorAll("tbody td")]
				.filter((td) => /^\d+\/\d+\/\d+$/.test(td.textContent ?? ""))
				.map((td) => getComputedStyle(td).color === text),
			columns: ["blue", "red"].flatMap((side) =>
				["photo", "champion", "name"].map((part) => {
					const xs = [
						...table.querySelectorAll(
							`[data-side=${side}] [data-part=${part}]`,
						),
					].map((el) => el.getBoundingClientRect().left);
					return Math.max(...xs) - Math.min(...xs);
				}),
			),
		};
	});
	expect(measure.scroll).toBeLessThanOrEqual(0);
	expect(measure.rows).toHaveLength(5);
	for (const row of measure.rows) expect(row).toBeGreaterThanOrEqual(56);
	for (const photo of measure.photos) expect(photo).toBeGreaterThanOrEqual(48);
	for (const badge of measure.badges) expect(badge).toBeGreaterThanOrEqual(28);
	expect(measure.names).toEqual(Array(10).fill(true));
	expect(measure.kda).toEqual(Array(10).fill(true));
	expect(measure.vision).toEqual([0, 2, 0, 0, 2]);
	// Pictures and name blocks sit in fixed tracks: none of them moves (#548).
	for (const spread of measure.columns) expect(spread).toBeLessThanOrEqual(1);
	await expectColumnsAligned(page);
	await expectHeaderIconsCentred(page);
}

/** #589: each stat header's icon is centred over its label (±1 px). */
async function expectHeaderIconsCentred(page: Page) {
	const offsets = await page.evaluate(() => {
		const table = document.querySelector("table[aria-label='Cara a cara']");
		if (!table) throw new Error("Missing face to face");
		const headers = [...table.querySelectorAll("thead th[scope=col]")].filter(
			(th) => th.querySelector("img, svg"),
		);
		return headers.map((th) => {
			const icon = th.querySelector("img, svg")?.getBoundingClientRect();
			const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT);
			let label: DOMRect | undefined;
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (!node.textContent?.trim()) continue;
				const range = document.createRange();
				range.selectNodeContents(node);
				label = range.getBoundingClientRect();
			}
			if (!icon || !label) throw new Error("Missing icon or label");
			return {
				label: th.textContent,
				offset: icon.left + icon.width / 2 - (label.left + label.width / 2),
			};
		});
	});
	expect(offsets).toHaveLength(6);
	for (const { offset } of offsets)
		expect(Math.abs(offset), JSON.stringify(offsets)).toBeLessThanOrEqual(1);
}

/**
 * #548: every column of the face to face starts where its header starts:
 * the left edge on blue's side, the right edge on red's (mirrored). Edges
 * come from the painted text and icons, not from the cells, so a label
 * centred in a wide cell fails.
 */
async function expectColumnsAligned(page: Page) {
	const edges = await page.evaluate(() => {
		const table = document.querySelector("table[aria-label='Cara a cara']");
		if (!table) throw new Error("Missing face to face");
		/** Painted extent of an element's text and icons, clipped to its box. */
		const extent = (el: Element, icons = true) => {
			const clip = el.getBoundingClientRect();
			const rects: DOMRect[] = [];
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (
					!node.textContent?.trim() ||
					node.parentElement?.closest(".sr-only")
				)
					continue;
				const range = document.createRange();
				range.selectNodeContents(node);
				rects.push(range.getBoundingClientRect());
			}
			if (icons)
				for (const svg of el.querySelectorAll("svg"))
					rects.push(svg.getBoundingClientRect());
			return {
				left: Math.max(clip.left, Math.min(...rects.map((r) => r.left))),
				right: Math.min(clip.right, Math.max(...rects.map((r) => r.right))),
			};
		};
		const headers = [...table.querySelectorAll("thead tr:last-child th")];
		const rows = [...table.querySelectorAll("tbody tr")];
		// Columns: player, K/D/A, CS, gold, lane, gold, CS, K/D/A, player.
		const column = (index: number, side: "blue" | "red") => {
			const edge = side === "blue" ? "left" : "right";
			const header = headers[index];
			if (!header) throw new Error(`Missing header ${index}`);
			const cells = rows.map((row) => {
				const cell = row.children[index];
				const target =
					index === 0 || index === 8
						? cell?.querySelector("[data-part=name] > span")
						: cell;
				if (!target) throw new Error(`Missing cell ${index}`);
				return Math.round(extent(target)[edge]);
			});
			// The header's edge is its label's: its icon is centred over it (#589).
			return { header: Math.round(extent(header, false)[edge]), cells };
		};
		return [
			...[0, 1, 2, 3].map((i) => column(i, "blue")),
			...[5, 6, 7, 8].map((i) => column(i, "red")),
		];
	});
	for (const { header, cells } of edges) {
		expect(cells).toHaveLength(5);
		for (const cell of cells)
			expect(
				Math.abs(cell - header),
				JSON.stringify(edges),
			).toBeLessThanOrEqual(1);
	}
}

test("replays a drafted game and continues to its result", async ({
	playwright,
}, testInfo) => {
	const app = await launchApp(
		{ playwright },
		{
			profileDir: testInfo.outputPath("profile"),
			systemLocale: "es-ES",
			env: { RIFT_E2E_CORE: "1" },
		},
	);
	try {
		const page = await app.firstWindow();
		await page.setViewportSize({ width: 1280, height: 720 });
		await app.evaluate(prepareDraft);
		await page.getByRole("button", { name: "Empezar serie" }).click();
		await page.getByRole("button", { name: "Jugar", exact: true }).click();
		await expect(page.getByRole("timer")).toBeVisible();
		await page.getByRole("button", { name: "Pausar" }).click();
		await page.getByRole("radio", { name: "×16" }).check({ force: true });
		await page.getByRole("button", { name: "Reanudar" }).click();
		await expect(
			page
				.getByRole("list", { name: "Eventos de la partida" })
				.getByRole("listitem")
				.first(),
		).toBeVisible();
		await page.getByRole("button", { name: "Saltar al final" }).click();
		await expect(page.getByRole("timer")).toBeInViewport();
		// Neither the window nor the main area scrolls at the minimum size.
		const overflow = await page.evaluate(() => {
			const main = document.querySelector("main");
			return {
				page: document.documentElement.scrollHeight - innerHeight,
				main: main ? main.scrollHeight - main.clientHeight : 0,
			};
		});
		expect(overflow.page).toBeLessThanOrEqual(0);
		expect(overflow.main).toBeLessThanOrEqual(0);
		await expectTeamPanelsInView(page);
		await expect(
			page.getByRole("button", { name: "Ver resultado" }),
		).toBeInViewport({ ratio: 1 });
		// The face-to-face panel takes the map's place without growing the page.
		const height = () =>
			page.evaluate(() => document.documentElement.scrollHeight);
		const before = await height();
		await page
			.getByRole("radio", { name: "Cara a cara" })
			.check({ force: true });
		const faceToFace = page.getByRole("table", { name: "Cara a cara" });
		await expect(faceToFace).toBeInViewport({ ratio: 1 });
		await expect(faceToFace.getByRole("row")).toHaveCount(7);
		// #450: each stat header (icon and label) keeps clear of its neighbours.
		const headerGaps = await faceToFace.evaluate((table) => {
			const boxes = [...table.querySelectorAll("thead th[scope=col]")]
				.map((th) => th.firstElementChild)
				.filter((label) => label?.querySelector("svg"))
				.map((label) => (label as Element).getBoundingClientRect());
			return boxes.slice(1).map((box, i) => box.left - (boxes[i]?.right ?? 0));
		});
		expect(headerGaps).toHaveLength(5);
		for (const gap of headerGaps) expect(gap).toBeGreaterThanOrEqual(12);
		// #433: a long handle is cut, and the pictures and the name block keep
		// their place in every row.
		await faceToFace
			.locator("[data-lane-player] [data-part=name] > span")
			.first()
			.evaluate((handle) => {
				handle.textContent = "Averyveryveryverylonghandlethatneverends";
			});
		const layout = await faceToFace.evaluate((table) =>
			["blue", "red"].flatMap((side) =>
				["photo", "champion", "name"].map((part) => {
					const boxes = [
						...table.querySelectorAll(
							`[data-side=${side}] [data-part=${part}]`,
						),
					].map((element) => element.getBoundingClientRect());
					return boxes.map((box) =>
						Math.round(part === "name" ? box.left + box.width / 2 : box.left),
					);
				}),
			),
		);
		for (const xs of layout) {
			expect(xs).toHaveLength(5);
			expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
		}
		const cut = await faceToFace
			.locator("[data-lane-player] [data-part=name] > span")
			.first()
			.evaluate((handle) => handle.scrollWidth > handle.clientWidth);
		expect(cut).toBe(true);
		expect(await height()).toBe(before);
		await expect(page.getByRole("figure")).toBeInViewport({ ratio: 1 });
		await expectBigFaceToFace(page);
		await page.setViewportSize({ width: 1366, height: 768 });
		await expect(faceToFace).toBeInViewport({ ratio: 1 });
		await expectBigFaceToFace(page);
		await page.getByRole("radio", { name: "Mapa" }).check({ force: true });
		await expectTeamPanelsInView(page);
		for (const team of ["Forge", "Shoal"]) {
			const panel = page.getByRole("region", {
				name: `Estructuras y objetivos de ${team}`,
			});
			const unused = await panel.evaluate((section) => {
				const effects = section.lastElementChild;
				if (!effects) throw new Error("Missing effects row");
				return (
					section.getBoundingClientRect().bottom -
					effects.getBoundingClientRect().bottom -
					Number.parseFloat(getComputedStyle(section).paddingBottom)
				);
			});
			expect(Math.abs(unused)).toBeLessThanOrEqual(1);
			const row = panel.getByRole("row", { name: /^Top/ });
			expect((await row.boundingBox())?.height).toBeGreaterThan(32);
		}
		await page.getByRole("button", { name: "Ver resultado" }).click();
		await expect(
			page.getByRole("heading", { level: 1, name: "Resultado" }),
		).toBeVisible();
		// #510: the stats table gains the vision column and still fits whole.
		const stats = page.getByRole("table", { name: "Estadísticas del mapa 1" });
		await expect(
			stats.getByRole("columnheader", { name: "Visión" }),
		).toBeVisible();
		for (const size of [
			{ width: 1280, height: 720 },
			{ width: 1366, height: 768 },
		]) {
			await page.setViewportSize(size);
			await expect(stats).toBeInViewport({ ratio: 1 });
			expect(
				await stats.evaluate((table) => {
					const box = table.parentElement;
					return box ? box.scrollWidth - box.clientWidth : 0;
				}),
			).toBeLessThanOrEqual(0);
		}
	} finally {
		await app.close();
	}
});
