import type { CoreBridge } from "../src/main/core-bridge";
import { expect, launchApp, test } from "./fixtures";

declare const riftCore: CoreBridge;

// Until the entire draft is playable, let both coaches complete it on the real
// bridge. The renderer receives the resulting position and handles match.play.
function prepareDraft() {
	const { send, query } = riftCore;
	const draft = async (body: string) => {
		const start = JSON.parse(body);
		start.payload.ai = ["coach", "coach"];
		start.payload.seed = 7;
		let result = await send(JSON.stringify(start));
		let assigned = 0;
		while (result.ok && "facts" in result) {
			assigned += result.facts.filter(
				(f) => f.type === "draft.rolesAssigned",
			).length;
			if (assigned === 2) return result;
			result = await send(
				JSON.stringify({
					v: start.v,
					sessionId: start.sessionId,
					expectedPosition: result.position,
					kind: "draft.ai",
					payload: {},
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
		await expect(page.getByRole("table", { name: "Objetivos" })).toBeInViewport(
			{ ratio: 1 },
		);
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
		expect(await height()).toBe(before);
		await page.getByRole("radio", { name: "Mapa" }).check({ force: true });
		await expect(page.getByRole("table", { name: "Objetivos" })).toBeInViewport(
			{ ratio: 1 },
		);
		await page.getByRole("button", { name: "Ver resultado" }).click();
		await expect(
			page.getByRole("heading", { level: 1, name: "Resultado" }),
		).toBeVisible();
	} finally {
		await app.close();
	}
});
