import type { AssetStatus } from "@rift-legends/contracts";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { GameRoleIcon } from "../src/renderer/assets/game-role-icon";
import { MapIcon } from "../src/renderer/match/map-icon";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

function renderWith(status: AssetStatus, ui: ReactElement) {
	return render(
		<AssetsProvider api={fakeAssets(status).api}>{ui}</AssetsProvider>,
	);
}

const ready: AssetStatus = { state: "ready", version: "15.4.1" };

describe("U2: official role icons", () => {
	test("use the cached CommunityDragon image when the cache is ready", async () => {
		renderWith(ready, <GameRoleIcon role="jungle" label="Jungle" />);
		await waitFor(() =>
			expect(screen.getByRole("img", { name: "Jungle" }).tagName).toBe("IMG"),
		);
		const icon = screen.getByRole("img", { name: "Jungle" });
		expect(icon.getAttribute("src")).toBe(
			"rift-asset://cdragon/roles/jungle.png",
		);
	});

	test.each([
		{ state: "missing" },
		{ state: "error" },
		{ state: "syncing", progress: { completed: 1, total: 9 } },
	] satisfies AssetStatus[])(
		"keep the own icon while the cache is $state",
		async (status) => {
			renderWith(status, <GameRoleIcon role="mid" label="Mid" />);
			await Promise.resolve();
			expect(
				screen.getByRole("img", { name: "Mid" }).tagName.toLowerCase(),
			).toBe("svg");
		},
	);

	test("keep the own icon outside a provider", () => {
		render(<GameRoleIcon role="top" label="Top" />);
		expect(screen.getByRole("img", { name: "Top" }).tagName.toLowerCase()).toBe(
			"svg",
		);
	});
});

describe("U2: official objective icons", () => {
	test.each([
		["dragon", "objectives/dragon.png"],
		["baron", "objectives/baron.png"],
		["herald", "objectives/herald.png"],
		["elder", "objectives/elder.png"],
		["tower", "objectives/tower.png"],
		["inhibitor", "objectives/inhibitor.png"],
		["nexus", "objectives/nexus.png"],
	] as const)("%s uses %s when the cache is ready", async (kind, path) => {
		const { container } = renderWith(ready, <MapIcon kind={kind} />);
		const image = await waitFor(() => {
			const found = container.querySelector("img");
			if (!found) throw new Error("no image yet");
			return found;
		});
		expect(image.getAttribute("src")).toBe(`rift-asset://cdragon/${path}`);
		expect(image.getAttribute("alt")).toBe("");
	});

	test("a destroyed structure shows its official icon greyed out", async () => {
		const { container } = renderWith(ready, <MapIcon kind="towerDown" />);
		const image = await waitFor(() => {
			const found = container.querySelector("img");
			if (!found) throw new Error("no image yet");
			return found;
		});
		expect(image.getAttribute("src")).toBe(
			"rift-asset://cdragon/objectives/tower.png",
		);
		expect(image.className).toContain("grayscale");
	});

	test("an image that fails falls back to the own drawing in the same box", async () => {
		const { container } = renderWith(ready, <MapIcon kind="dragon" />);
		const image = await waitFor(() => {
			const found = container.querySelector("img");
			if (!found) throw new Error("no image yet");
			return found;
		});
		const box = image.getAttribute("class")?.match(/size-\S+/)?.[0];
		fireEvent.error(image);
		const drawing = container.querySelector("svg");
		expect(container.querySelector("img")).toBeNull();
		expect(box).toBeTruthy();
		expect(drawing?.getAttribute("class")).toContain(box);
	});

	test("without the cache the own drawing is used", async () => {
		const { container } = renderWith(
			{ state: "missing" },
			<MapIcon kind="baron" />,
		);
		await Promise.resolve();
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("svg")).toBeTruthy();
	});
});
