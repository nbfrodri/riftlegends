import { expect, test } from "./fixtures";
import { seedNextSeries } from "./quick-draft-flow";

test.use({ appEnv: { RIFT_E2E_CORE: "1" } });

// Plan 09, U1 and U2 in the real app: configure a series against the real core
// and reach the screen after the side choice.
test("configures a series and goes on to the draft after choosing a side", async ({
	appWindow,
	electronApp,
}) => {
	await expect(
		appWindow.getByRole("heading", { level: 1, name: "Set up series" }),
	).toBeVisible();
	await expect(
		appWindow.getByRole("complementary", { name: "Rival staff" }),
	).toContainText("Iko Rhane");

	await appWindow.getByRole("radio", { name: "Bo1" }).check({ force: true });
	await seedNextSeries(electronApp, 7);
	await appWindow.getByRole("button", { name: "Start series" }).click();

	await expect(
		appWindow.getByRole("heading", { level: 1, name: "Side choice" }),
	).toBeVisible();
	await appWindow
		.getByRole("radio", { name: "Red side" })
		.check({ force: true });
	await appWindow.getByRole("button", { name: "Confirm choice" }).click();
	await appWindow.getByRole("button", { name: "Go to draft" }).click();

	await expect(
		appWindow.getByRole("heading", { level: 1, name: "Draft", exact: true }),
	).toBeVisible();
});
