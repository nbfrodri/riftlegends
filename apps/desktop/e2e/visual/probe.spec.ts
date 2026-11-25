import { createHash } from "node:crypto";
import { expect, test } from "../fixtures";

test.skip(process.platform !== "linux", "linux only");
test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CONTENT: "fictional" } });

const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex").slice(0, 8);

test("probe", async ({ appWindow: page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configurar serie");
	await page
		.getByRole("navigation", { name: "Secciones del club" })
		.getByRole("button", { name: "Campeones" })
		.click();
	await expect(page.getByRole("button", { name: "Cragbell" })).toBeVisible();
	await page.getByRole("radiogroup", { name: "Vista" }).getByText("Lista completa").click();
	await page.mouse.move(0, 0);
	await page.waitForTimeout(1500);
	const shot = async () => page.screenshot({ animations: "disabled", caret: "hide" });
	const out: string[] = [];
	const clip = { x: 410, y: 88, width: 20, height: 14 };
	const px = async () => md5(await page.screenshot({ clip }));
	for (let i = 0; i < 4; i++) out.push(`plain${i} ${md5(await shot())} clip ${await px()}`);
	await page.setViewportSize({ width: 1367, height: 768 });
	await page.setViewportSize({ width: 1366, height: 768 });
	for (let i = 0; i < 3; i++) out.push(`resized${i} ${md5(await shot())} clip ${await px()}`);
	await page.evaluate(() => {
		document.body.style.display = "none";
		void document.body.offsetHeight;
		document.body.style.display = "";
	});
	await page.waitForTimeout(500);
	for (let i = 0; i < 3; i++) out.push(`relayout${i} ${md5(await shot())} clip ${await px()}`);
	const info = await page.evaluate(() => {
		const el = [...document.querySelectorAll("[data-portrait-frame]")].map((e) => {
			const r = (e.parentElement as HTMLElement).getBoundingClientRect();
			return `${r.x},${r.y},${r.width}x${r.height}`;
		});
		return el.slice(0, 6).join(" | ");
	});
	out.push(`rects ${info}`);
	console.log(`PROBE\n${out.join("\n")}`);
});
