import type {
	AssetStatus,
	MatchEvent,
	MatchView,
} from "@rift-legends/contracts";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { GameRoleIcon } from "../src/renderer/assets/game-role-icon";
import { MapIcon } from "../src/renderer/assets/map-icon";
import { StatIcon } from "../src/renderer/assets/stat-icon";
import { EventFeed } from "../src/renderer/match/event-feed";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

function renderWith(status: AssetStatus, ui: ReactElement) {
	return render(
		<AssetsProvider api={fakeAssets(status).api}>{ui}</AssetsProvider>,
	);
}

// Named positions: a literal `role="…"` reads as an ARIA role to the linter.
const positions = {
	top: "top",
	jungle: "jungle",
	mid: "mid",
	bot: "bot",
} as const;

const ready: AssetStatus = { state: "ready", version: "15.4.1" };

describe("U2: official role icons", () => {
	test("use the cached CommunityDragon image when the cache is ready", async () => {
		renderWith(ready, <GameRoleIcon role={positions.jungle} label="Jungle" />);
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
			renderWith(status, <GameRoleIcon role={positions.mid} label="Mid" />);
			await Promise.resolve();
			expect(
				screen.getByRole("img", { name: "Mid" }).tagName.toLowerCase(),
			).toBe("svg");
		},
	);

	test("keep the own icon outside a provider", () => {
		render(<GameRoleIcon role={positions.top} label="Top" />);
		expect(screen.getByRole("img", { name: "Top" }).tagName.toLowerCase()).toBe(
			"svg",
		);
	});
});

describe("official stat icons", () => {
	test.each(["kda", "gold", "cs", "damage", "vision"] as const)(
		"%s shows the cached client icon and falls back to the own one if it fails",
		async (stat) => {
			const { container } = renderWith(ready, <StatIcon stat={stat} />);
			// A CSS mask over a rift-asset:// SVG does not load in Electron (#312),
			// so the icon must be a plain image like the role icons.
			const image = await waitFor(() => {
				const found = container.querySelector("img");
				if (!found) throw new Error("no image yet");
				return found;
			});
			expect(image.getAttribute("src")).toBe(
				`rift-asset://cdragon/stats/${stat}.svg`,
			);
			expect(image.getAttribute("alt")).toBe("");
			expect(image.getAttribute("aria-hidden")).toBe("true");
			expect(image.getAttribute("width")).toBe("14");
			expect(image.getAttribute("height")).toBe("14");
			fireEvent.error(image);
			expect(container.querySelector("img")).toBeNull();
			const fallback = container.querySelector("svg");
			expect(fallback?.getAttribute("aria-hidden")).toBe("true");
			expect(fallback?.getAttribute("width")).toBe("14");
			expect(fallback?.getAttribute("height")).toBe("14");
		},
	);

	test("without the cache the own icon is used", async () => {
		const { container } = renderWith(
			{ state: "missing" },
			<StatIcon stat="gold" />,
		);
		await Promise.resolve();
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
			"true",
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

describe("objective events in the feed", () => {
	const event = (
		kind: MatchEvent["kind"],
		second: number,
	): MatchView["facts"][number] => ({
		type: "match.event",
		game: 1,
		minute: 1,
		second,
		kind,
		side: "blue",
		zone: "dragon-pit",
		kills: [],
		gold: { blue: 0, red: 0 },
		chance: 5000,
		causes: [],
	});

	test("show the objective's official icon next to the title", async () => {
		renderWith(
			ready,
			<EventFeed
				facts={[event("dragon", 10), event("tower", 20), event("kill", 30)]}
				second={60}
				names={{ blue: "Blue", red: "Red" }}
				championByPlayer={new Map()}
				ended
			/>,
		);
		const rows = await waitFor(() => {
			const found = screen.getAllByRole("listitem");
			if (!found[1]?.querySelector("img")) throw new Error("no image yet");
			return found;
		});
		const icon = (row: HTMLElement | undefined) =>
			row?.querySelector("h3 img")?.getAttribute("src");
		expect(icon(rows[0])).toBeUndefined();
		expect(icon(rows[1])).toBe("rift-asset://cdragon/objectives/tower.png");
		expect(icon(rows[2])).toBe("rift-asset://cdragon/objectives/dragon.png");
	});
});
