import type {
	AssetStatus,
	MatchEvent,
	MatchView,
} from "@rift-legends/contracts";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { GameRoleIcon } from "../src/renderer/assets/game-role-icon";
import { MapIcon } from "../src/renderer/assets/map-icon";
import { StatIcon } from "../src/renderer/assets/stat-icon";
import { EventFeed } from "../src/renderer/match/event-feed";
import { FaceToFace } from "../src/renderer/match/face-to-face";
import { GoldChart } from "../src/renderer/match/gold-chart";
import { teamMap } from "../src/renderer/match/team-map";
import { TeamPanel } from "../src/renderer/match/team-panel";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

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
			// The client's grey icons are brightened to read on the dark panels.
			expect(image.classList.contains("brightness-200")).toBe(true);
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
		["grub", "objectives/grub.png"],
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

	test("#380: a standing structure or taken objective shows the official image unmasked", async () => {
		const { container } = renderWith(ready, <MapIcon kind="tower" />);
		const image = await waitFor(() => {
			const found = container.querySelector("img");
			if (!found) throw new Error("no image yet");
			return found;
		});
		expect(image.getAttribute("src")).toBe(
			"rift-asset://cdragon/objectives/tower.png",
		);
		expect(image.className).not.toMatch(/filter|mask|grayscale/);
		fireEvent.error(image);
		expect(container.querySelector("svg")?.getAttribute("stroke")).toBe(
			"currentColor",
		);
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

	test.each(["baron", "grub"] as const)(
		"without the cache the own %s drawing is used",
		async (kind) => {
			const { container } = renderWith(
				{ state: "missing" },
				<MapIcon kind={kind} />,
			);
			await Promise.resolve();
			expect(container.querySelector("img")).toBeNull();
			expect(container.querySelector("svg")).toBeTruthy();
		},
	);
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
				ids={{ blue: "blue", red: "red" }}
				players={new Map()}
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

	test("a void grub shows its official icon and its name", async () => {
		renderWith(
			ready,
			<EventFeed
				facts={[event("grub", 10)]}
				second={60}
				names={{ blue: "Blue", red: "Red" }}
				ids={{ blue: "blue", red: "red" }}
				players={new Map()}
				ended
			/>,
		);
		const row = await waitFor(() => {
			const found = screen.getByRole("listitem");
			if (!found.querySelector("img")) throw new Error("no image yet");
			return found;
		});
		expect(row.querySelector("h3 img")?.getAttribute("src")).toBe(
			"rift-asset://cdragon/objectives/grub.png",
		);
	});
});

describe("fight events in the feed", () => {
	const fight: MatchView["facts"][number] = {
		type: "match.event",
		game: 1,
		minute: 1,
		second: 10,
		kind: "fight",
		side: "blue",
		zone: "lane-mid",
		kills: [{ killer: "b-mid", victim: "r-mid", assists: ["b-jungle"] }],
		gold: { blue: 0, red: 0 },
		chance: 5000,
		causes: [],
	};
	const players = new Map([
		[
			"b-mid",
			{ handle: "Faker", champion: "ahri", championName: "Ahri", role: "mid" },
		],
		[
			"r-mid",
			{ handle: "Chovy", champion: "azir", championName: "Azir", role: "mid" },
		],
		[
			"b-jungle",
			{ handle: "Oner", champion: "vi", championName: "Vi", role: "jungle" },
		],
	] as const);
	const feed = (
		<EventFeed
			facts={[fight]}
			second={60}
			names={{ blue: "T1", red: "Gen.G" }}
			ids={{ blue: "T1", red: "Gen.G" }}
			players={players}
			ended
		/>
	);

	test("name the players with their roles and the team by logo", async () => {
		const assets = fakeAssets(ready);
		assets.api.teamLogos.mockResolvedValue({ T1: "rift-asset://logos/t1.png" });
		await renderInLocale(
			<AssetsProvider api={assets.api}>{feed}</AssetsProvider>,
		);
		const row = screen.getByRole("listitem");
		expect(within(row).getByText("Faker")).toBeTruthy();
		expect(within(row).getByText("Chovy")).toBeTruthy();
		expect(within(row).getByText("Oner")).toBeTruthy();
		expect(within(row).queryByText("Ahri")).toBeNull();
		expect(within(row).getAllByRole("img", { name: "Mid" })).toHaveLength(2);
		expect(within(row).getByRole("img", { name: "Jungle" })).toBeTruthy();
		expect(within(row).getByRole("img", { name: "Ahri" })).toBeTruthy();
		const assists = row.querySelector("[data-assists]");
		expect(assists?.textContent).toContain("Oner");
		expect(assists?.textContent).not.toContain("Faker");
		const team = within(row).getByRole("img", { name: "T1" });
		await waitFor(() =>
			expect(team.querySelector("img")?.getAttribute("src")).toBe(
				"rift-asset://logos/t1.png",
			),
		);
	});

	test("fall back to the own crest, still named after the team", async () => {
		await renderInLocale(
			<AssetsProvider api={fakeAssets(ready).api}>{feed}</AssetsProvider>,
		);
		const team = within(screen.getByRole("listitem")).getByRole("img", {
			name: "T1",
		});
		expect(team.querySelector("svg")).toBeTruthy();
		expect(team.querySelector("img")).toBeNull();
	});
});

const emptySide = {
	gold: 0,
	kills: 0,
	towers: { top: 0, mid: 0, bot: 0 },
	nexusTowers: 0,
	inhibitors: { top: null, mid: null, bot: null },
	dragons: 0,
	soul: false,
	grubs: 0,
	heralds: 0,
	barons: 0,
	elders: 0,
	buffs: { herald: null, baron: null, elder: null },
};

describe("team panel", () => {
	const side = {
		gold: 0,
		kills: 0,
		towers: { top: 1, mid: 0, bot: 0 },
		nexusTowers: 0,
		inhibitors: { top: null, mid: null, bot: null },
		dragons: 2,
		soul: false,
		grubs: 0,
		heralds: 1,
		barons: 0,
		elders: 0,
		buffs: { herald: null, baron: null, elder: null },
	};

	test("draws structures and objectives with the official icons, never as a silhouette", async () => {
		await renderInLocale(
			<AssetsProvider api={fakeAssets(ready).api}>
				<TeamPanel side="blue" name="Blue" view={teamMap(side, 60)} />
			</AssetsProvider>,
		);
		const panel = await waitFor(() => {
			const found = screen.getByRole("region", { name: /Blue/ });
			if (!found.querySelector("img")) throw new Error("no image yet");
			return found;
		});
		expect(panel.querySelectorAll("svg path")).toHaveLength(0);
		const objective = (name: RegExp) =>
			screen.getByText(name).closest("dt")?.querySelector("img");
		for (const [name, file] of [
			[/Grubs/, "grub"],
			[/Dragons/, "dragon"],
			[/Heralds/, "herald"],
			[/Barons/, "baron"],
			[/Elders/, "elder"],
		] as const)
			expect(objective(name)?.getAttribute("src")).toBe(
				`rift-asset://cdragon/objectives/${file}.png`,
			);
		for (const img of panel.querySelectorAll("img"))
			expect(img.className).not.toMatch(/filter|mask/);
		expect(panel.querySelector("filter")).toBeNull();
		expect(
			screen
				.getByText(/Barons/)
				.closest("[data-taken]")
				?.getAttribute("data-taken"),
		).toBe("false");
		const structures = screen.getByRole("table");
		const sources = (name: string) =>
			within(structures)
				.getAllByRole("img", { name })
				.map((icon) => icon.querySelector("img")?.getAttribute("src"));
		const official = (file: string) =>
			`rift-asset://cdragon/objectives/${file}.png`;
		expect(new Set(sources("Standing tower"))).toEqual(
			new Set([official("tower")]),
		);
		expect(sources("Destroyed tower")).toEqual([official("tower")]);
		expect(sources("Standing inhibitor")).toEqual(
			Array(3).fill(official("inhibitor")),
		);
		expect(sources("Standing nexus")).toEqual([official("nexus")]);
		expect(
			structures.querySelector("thead tr")?.classList.contains("sr-only"),
		).toBe(false);
		expect(
			within(structures).getAllByRole("img", { name: "Destroyed tower" }),
		).toHaveLength(1);
	});
});

describe("match stat headers", () => {
	test("the face to face and the gold chart use the client's stat icons", async () => {
		const snapshot = {
			minute: 0,
			blue: { ...emptySide },
			red: { ...emptySide },
			players: [],
		};
		await renderInLocale(
			<AssetsProvider api={fakeAssets(ready).api}>
				<FaceToFace
					snapshot={snapshot}
					names={{ blue: "Blue", red: "Red" }}
					lineup={new Map()}
				/>
				<GoldChart
					snapshots={[snapshot]}
					index={0}
					names={{ blue: "Blue", red: "Red" }}
					duration={60}
				/>
			</AssetsProvider>,
		);
		const table = await screen.findByRole("table", { name: "Face to face" });
		await waitFor(() => {
			if (!table.querySelector("img")) throw new Error("no image yet");
		});
		const header = (name: string) =>
			within(table)
				.getAllByRole("columnheader", { name })
				.map((cell) => cell.querySelector("img")?.getAttribute("src"));
		for (const [name, stat] of [
			["K/D/A", "kda"],
			["CS", "cs"],
			["Gold", "gold"],
		] as const)
			expect(header(name)).toEqual(
				Array(2).fill(`rift-asset://cdragon/stats/${stat}.svg`),
			);
		expect(
			screen
				.getByRole("figure")
				.querySelector("figcaption img")
				?.getAttribute("src"),
		).toBe("rift-asset://cdragon/stats/gold.svg");
	});
});
