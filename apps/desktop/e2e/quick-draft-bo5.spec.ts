import { expect, test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CORE: "1" } });

test("E1: plays a Bo5 against the AI from setup to the series result", async ({
	electronApp,
	appWindow,
}) => {
	// A whole Bo5 with the AI pauses takes over a minute; leave room for slow CI.
	test.setTimeout(240_000);
	await playQuickDraftBo5(electronApp, appWindow, async (screen) => {
		const flags = appWindow.getByRole("img", { name: "Reino Unido" });
		if (screen === "draft") await expect(flags).toBeVisible();
		if (screen === "roles") await expect(flags.first()).toBeVisible();
		if (screen === "game-result")
			await expect(
				appWindow.getByRole("rowheader").filter({ has: flags }).first(),
			).toBeVisible();
	});
});
