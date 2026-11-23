import { expect } from "../fixtures";
import { test } from "../startup-fixtures";
import { captureScreen } from "./capture";

test.use({ systemLocale: "es-ES" });
test("carga inicial", async ({ startup: { page } }) => {
	test.skip(process.platform !== "linux", "Linux CI baseline");
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.getByRole("progressbar")).toBeVisible();
	await captureScreen(page, "carga-inicial.png");
});
