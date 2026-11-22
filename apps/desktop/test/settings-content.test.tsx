import type { AssetStatus } from "@rift-legends/contracts";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { ContentSettings } from "../src/renderer/assets/content-settings";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

async function renderContent(status: AssetStatus, locale = "en-US") {
	const bridge = fakeAssets(status);
	const view = await renderInLocale(
		<AssetsProvider api={bridge.api}>
			<ContentSettings />
		</AssetsProvider>,
		locale,
	);
	const section = await screen.findByRole("region", {
		name: /content|contenido/i,
	});
	return { bridge, view, section, user: userEvent.setup() };
}

describe("U3: Content section in Settings", () => {
	test("not downloaded: says so and offers to download", async () => {
		const { section } = await renderContent({ state: "missing" });
		expect(await within(section).findByText(/not downloaded/i)).toBeTruthy();
		const button = within(section).getByRole("button", { name: "Download" });
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(within(section).queryByRole("progressbar")).toBeNull();
	});

	test("downloading: shows completed of total and disables the button", async () => {
		const { section } = await renderContent({
			state: "syncing",
			progress: { completed: 3, total: 12 },
		});
		const bar = await within(section).findByRole("progressbar", {
			name: "Download progress",
		});
		expect(bar.getAttribute("aria-valuenow")).toBe("3");
		expect(bar.getAttribute("aria-valuemax")).toBe("12");
		expect(within(section).getByText("3 of 12 files")).toBeTruthy();
		expect(
			within(section)
				.getByRole("button", { name: "Download" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	test("ready: shows the version", async () => {
		const { section } = await renderContent({
			state: "ready",
			version: "15.4.1",
		});
		expect(await within(section).findByText(/version 15\.4\.1/i)).toBeTruthy();
		expect(
			within(section).getByRole("button", { name: "Check for updates" }),
		).toBeTruthy();
	});

	test("error: explains it in plain words and offers a retry", async () => {
		const { section } = await renderContent({ state: "error" });
		expect(
			await within(section).findByText(/could not download/i),
		).toBeTruthy();
		expect(within(section).getByRole("button", { name: "Retry" })).toBeTruthy();
	});

	test("speaks Spanish", async () => {
		const { section } = await renderContent({ state: "missing" }, "es-ES");
		expect(await within(section).findByText(/sin descargar/i)).toBeTruthy();
		expect(
			within(section).getByRole("button", { name: "Descargar" }),
		).toBeTruthy();
	});

	test("retry calls sync, follows progress and shows the result", async () => {
		const { bridge, section, user } = await renderContent({ state: "error" });
		await user.click(
			await within(section).findByRole("button", { name: "Retry" }),
		);
		expect(bridge.api.sync).toHaveBeenCalledTimes(1);
		const button = within(section).getByRole("button", { name: "Download" });
		expect(button.hasAttribute("disabled")).toBe(true);

		act(() => bridge.progress({ completed: 5, total: 10 }));
		expect(within(section).getByText("5 of 10 files")).toBeTruthy();

		await act(async () => bridge.finish({ state: "ready", version: "15.5.1" }));
		expect(within(section).getByText(/version 15\.5\.1/i)).toBeTruthy();
		expect(within(section).queryByRole("progressbar")).toBeNull();
	});

	test("a failed sync call shows the error state", async () => {
		const { bridge, section, user } = await renderContent({ state: "missing" });
		bridge.api.sync.mockRejectedValueOnce(new Error("ipc"));
		await user.click(
			await within(section).findByRole("button", { name: "Download" }),
		);
		expect(
			await within(section).findByText(/could not download/i),
		).toBeTruthy();
	});

	test("progress from the startup sync moves the section to downloading", async () => {
		const { bridge, section } = await renderContent({ state: "missing" });
		await within(section).findByText(/not downloaded/i);
		act(() => bridge.progress({ completed: 1, total: 4 }));
		expect(within(section).getByText("1 of 4 files")).toBeTruthy();
	});

	test("unsubscribes from progress on unmount", async () => {
		const { bridge, view } = await renderContent({ state: "missing" });
		expect(bridge.api.subscribe).toHaveBeenCalledTimes(1);
		view.unmount();
		expect(bridge.unsubscribe).toHaveBeenCalledTimes(1);
	});
});
