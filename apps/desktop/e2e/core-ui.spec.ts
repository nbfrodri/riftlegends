import type { ElectronApplication } from "@playwright/test";
import { expect, launchApp, test } from "./fixtures";

// E1 (plan 04): the renderer drives the real core and survives a crash.
const corePid = (app: ElectronApplication) =>
	app.evaluate(
		({ app }) =>
			app.getAppMetrics().find((p) => p.name === "Rift Legends core")?.pid,
	);

test("a command's fact reaches the screen, also after the core is killed", async ({
	playwright,
}, testInfo) => {
	const app = await launchApp(
		{ playwright },
		{
			profileDir: testInfo.outputPath("profile"),
			systemLocale: "en-US",
			env: { RIFT_E2E_PROBE: "1" },
		},
	);
	try {
		const window = await app.firstWindow();
		const probe = window.getByRole("region", { name: "Core probe" });
		const count = probe.getByRole("status");
		const tick = probe.getByRole("button", { name: "Tick" });

		await expect(count).toHaveText("0");
		await tick.click();
		await expect(count).toHaveText("1");

		const pid = await corePid(app);
		expect(pid).toBeGreaterThan(0);
		process.kill(pid as number, "SIGKILL");
		await expect.poll(() => corePid(app)).not.toBe(pid);

		// The session lived in memory: the command fails and the UI starts over.
		await tick.click();
		await expect(probe.getByRole("alert")).toBeVisible();
		await expect(count).toHaveText("0");

		await tick.click();
		await expect(count).toHaveText("1");
		await expect(probe.getByRole("alert")).toHaveCount(0);
	} finally {
		await app.close();
	}
});
