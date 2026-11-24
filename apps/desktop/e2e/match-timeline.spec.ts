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
			page.getByRole("region", { name: `${team} · estructuras y objetivos` }),
		).toBeInViewport({ ratio: 1 });
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
		await page.setViewportSize({ width: 1366, height: 768 });
		await expect(faceToFace).toBeInViewport({ ratio: 1 });
		await page.getByRole("radio", { name: "Mapa" }).check({ force: true });
		await expectTeamPanelsInView(page);
		for (const team of ["Forge", "Shoal"]) {
			const panel = page.getByRole("region", {
				name: `${team} · estructuras y objetivos`,
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
	} finally {
		await app.close();
	}
});
