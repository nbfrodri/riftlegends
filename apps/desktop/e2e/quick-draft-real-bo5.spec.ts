import { expect, test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({
	systemLocale: "es-ES",
	appEnv: { RIFT_E2E_CORE: "1", RIFT_E2E_CONTENT: "real" },
	seedAssetCache: true,
});

test("A5: completes a fearless hard Bo5 with the real content offline", async ({
	electronApp,
	appWindow,
}) => {
	test.setTimeout(240_000);
	// The seeded cache lacks the official sounds and the network is off (#555).
	await appWindow
		.getByRole("button", { name: "Continuar", exact: true })
		.click({ timeout: 15_000 });
	await expect(
		appWindow.getByRole("heading", { name: "Configurar serie", exact: true }),
	).toBeVisible({ timeout: 15_000 });
	await playQuickDraftBo5(electronApp, appWindow, undefined, undefined, [
		"Gen.G",
		"Bilibili Gaming",
	]);
});
