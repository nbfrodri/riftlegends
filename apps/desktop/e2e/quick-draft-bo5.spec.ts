import { test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CORE: "1" } });

test("E1: plays a Bo5 against the AI from setup to the series result", async ({
	electronApp,
	appWindow,
}) => {
	test.setTimeout(120_000);
	await playQuickDraftBo5(electronApp, appWindow);
});
