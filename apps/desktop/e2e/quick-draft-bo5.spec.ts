import { test } from "./fixtures";
import { playQuickDraftBo5 } from "./quick-draft-flow";

test.use({ systemLocale: "es-ES", appEnv: { RIFT_E2E_CORE: "1" } });

test("E1: plays a Bo5 against the AI from setup to the series result", async ({
	electronApp,
	appWindow,
}) => {
	// A whole Bo5 with the AI pauses takes over a minute; leave room for slow CI.
	test.setTimeout(240_000);
	await playQuickDraftBo5(electronApp, appWindow);
});
