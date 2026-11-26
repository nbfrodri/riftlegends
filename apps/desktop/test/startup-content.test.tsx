import { loadRealContent } from "@rift-legends/core";
import { RouterProvider } from "@tanstack/react-router";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createAppRouter } from "../src/renderer/router";
import { renderWithDraftCore } from "./draft-core";
import { fakeAssets, testCatalog } from "./fake-assets";

afterEach(cleanup);
const ids = loadRealContent().draft.champions.map((c) => c.id);
const ready = { state: "ready", version: "16.23" } as const;
const open = (assets: ReturnType<typeof fakeAssets>) =>
	renderWithDraftCore(
		<RouterProvider router={createAppRouter()} />,
		"en-US",
		undefined,
		undefined,
		{ assets: assets.api, content: "real" },
	);

test("shows download progress before mounting navigation or draft", async () => {
	await open(
		fakeAssets({ state: "syncing", progress: { completed: 3, total: 8 } }),
	);
	expect(
		(await screen.findByRole("progressbar")).getAttribute("aria-valuenow"),
	).toBe("3");
	expect(screen.queryByRole("navigation")).toBeNull();
	expect(screen.queryByRole("button", { name: "Start series" })).toBeNull();
});

test.each(["error", "missing"] as const)(
	"recovers from %s after retry with a complete cache",
	async (state) => {
		const assets = fakeAssets({ state }, testCatalog(ids));
		await open(assets);
		expect(await screen.findByText(/connect once/i)).toBeTruthy();
		await userEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(assets.api.sync).toHaveBeenCalledOnce();
		expect(screen.getByRole("progressbar")).toBeTruthy();
		await act(async () => assets.finish(ready));
		expect(
			await screen.findByRole(
				"heading",
				{ name: "Set up series" },
				{ timeout: 8000 },
			),
		).toBeTruthy();
	},
);
test("rejects a verified catalog missing a real champion", async () => {
	await open(fakeAssets(ready, testCatalog(ids.slice(1))));
	expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
	expect(screen.queryByRole("navigation")).toBeNull();
});

test("opens from the complete installed catalog during the background update check", async () => {
	await open(
		fakeAssets(
			{
				state: "syncing",
				progress: { completed: 0, total: 0, cachedVersion: "16.23" },
			},
			testCatalog(ids),
		),
	);
	expect(
		await screen.findByRole(
			"heading",
			{ name: "Set up series" },
			{ timeout: 5000 },
		),
	).toBeTruthy();
});

test("#555: holds the loading screen while the cache is incomplete, then opens", async () => {
	const assets = fakeAssets(
		{
			state: "syncing",
			progress: { completed: 2, total: 5, incomplete: true },
		},
		testCatalog(ids),
	);
	await open(assets);
	expect(
		(await screen.findByRole("progressbar")).getAttribute("aria-valuenow"),
	).toBe("2");
	expect(screen.getByText("Downloading…")).toBeTruthy();
	expect(screen.queryByRole("navigation")).toBeNull();
	await act(async () => assets.finish(ready));
	expect(
		await screen.findByRole(
			"heading",
			{ name: "Set up series" },
			{ timeout: 8000 },
		),
	).toBeTruthy();
});

test("#555: offline with an incomplete cache shows a notice and lets the player continue", async () => {
	await open(
		fakeAssets(
			{ state: "ready", version: "16.23", incomplete: true },
			testCatalog(ids),
		),
	);
	expect(await screen.findByText(/official images and sounds/i)).toBeTruthy();
	expect(screen.queryByRole("navigation")).toBeNull();
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));
	expect(
		await screen.findByRole(
			"heading",
			{ name: "Set up series" },
			{ timeout: 8000 },
		),
	).toBeTruthy();
});

// #570: main sends progress events and answers status polls on different
// pipes, so a progress event sent just before "ready" can arrive after it.
test("#570: a late progress event after the offline notice does not open the app", async () => {
	const assets = fakeAssets(
		{ state: "ready", version: "16.23", incomplete: true },
		testCatalog(ids),
	);
	await open(assets);
	expect(await screen.findByText(/official images and sounds/i)).toBeTruthy();
	await act(async () =>
		assets.progress({ completed: 0, total: 5, incomplete: true }),
	);
	expect(screen.queryByRole("navigation")).toBeNull();
	// The status poll then answers what main really has: ready, offline.
	assets.api.status.mockResolvedValue({
		state: "ready",
		version: "16.23",
		incomplete: true,
	});
	expect(
		await screen.findByRole("button", { name: "Continue" }, { timeout: 4000 }),
	).toBeTruthy();
	expect(screen.queryByRole("navigation")).toBeNull();
});
