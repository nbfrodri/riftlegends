import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import {
	LIBRARIES,
	LIBRARY_GROUPS,
	riotNotice,
	SOURCES,
} from "../src/renderer/credits/credits-data";
import { createAppRouter } from "../src/renderer/router";
import { CREDIT_LINK_HOSTS } from "../src/shared/external-links";
import { fakeAssets } from "./fake-assets";
import { renderInLocale } from "./render-in-locale";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const json = (path: string) => JSON.parse(read(path));

beforeEach(() => {
	localStorage.clear();
	window.history.replaceState(null, "", "?content=fictional");
});
afterEach(cleanup);

async function renderAt(path: string, locale = "en-US") {
	await renderInLocale(
		<AssetsProvider api={fakeAssets().api}>
			<RouterProvider router={createAppRouter(path)} />
		</AssetsProvider>,
		locale,
	);
	await screen.findByRole("heading", { level: 1 });
	return userEvent.setup();
}

describe("credits view", () => {
	test("opens from Settings and goes back", async () => {
		const user = await renderAt("/ajustes");
		await user.click(screen.getByRole("link", { name: "View credits" }));
		expect(
			await screen.findByRole("heading", { level: 1, name: "Credits" }),
		).toBeTruthy();
		const back = screen.getByRole("link", { name: "Back to Settings" });
		expect(back.className).toContain("border-line");
		await user.click(back);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Settings" }),
		).toBeTruthy();
	});

	test("shows one card per data source with its use, badge and link", async () => {
		await renderAt("/ajustes/creditos");
		const sources = screen.getByRole("region", { name: "Data sources" });
		const cards = within(sources).getAllByRole("article");
		expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
			"Leaguepedia",
			"CommunityDragon",
			"lolesports.com",
			"Kenney",
		]);
		const [leaguepedia, communityDragon, lolesports, kenney] = cards as [
			HTMLElement,
			HTMLElement,
			HTMLElement,
			HTMLElement,
		];
		expect(
			within(kenney)
				.getByRole("link", { name: "CC0 1.0" })
				.getAttribute("href"),
		).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
		expect(
			within(kenney)
				.getByRole("link", { name: "Open the Kenney site" })
				.getAttribute("href"),
		).toBe("https://kenney.nl/assets/cursor-pack");
		expect(
			within(leaguepedia)
				.getByRole("link", { name: "Open the Leaguepedia site" })
				.getAttribute("href"),
		).toBe("https://lol.fandom.com/wiki/Leaguepedia");
		expect(
			within(leaguepedia)
				.getByRole("link", { name: "CC BY-SA 3.0" })
				.getAttribute("href"),
		).toBe("https://creativecommons.org/licenses/by-sa/3.0/");
		expect(within(communityDragon).getByText("Local cache")).toBeTruthy();
		expect(within(lolesports).getByText("Public API")).toBeTruthy();
		for (const card of cards) {
			expect(card.querySelector("svg")).toBeTruthy();
		}
	});

	test("shows the game icon next to the title", async () => {
		await renderAt("/ajustes/creditos");
		const title = screen.getByRole("heading", { level: 1, name: "Credits" });
		expect(
			title.parentElement?.querySelector('img[src="./icon-small.svg"]'),
		).toBeTruthy();
	});

	test("underlines nothing", async () => {
		await renderAt("/ajustes/creditos");
		const view = screen.getByRole("heading", { level: 1 }).closest("main");
		const elements = [...(view ?? document.body).querySelectorAll("*")];
		expect(elements.length).toBeGreaterThan(20);
		for (const element of elements) {
			expect(element.getAttribute("class") ?? "").not.toMatch(
				/(^|\s|:)underline(\s|$)/,
			);
			expect(getComputedStyle(element).textDecorationLine).not.toContain(
				"underline",
			);
		}
	});

	test("shows the Riot Games notice from NOTICE.md", async () => {
		await renderAt("/ajustes/creditos");
		const legal = screen.getByRole("region", { name: "Legal notice" });
		expect(legal.textContent).toContain(riotNotice);
		expect(riotNotice).toMatch(/^Rift Legends isn't endorsed by Riot Games/);
		expect(read("NOTICE.md")).toContain(riotNotice);
	});

	test("opens links in a new window so the app never navigates", async () => {
		await renderAt("/ajustes/creditos");
		for (const link of screen.getAllByRole("link", {
			name: (_, el) => el.getAttribute("href")?.startsWith("https:") ?? false,
		})) {
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toContain("noreferrer");
		}
	});

	test("lists every open-source library once, grouped by area", async () => {
		await renderAt("/ajustes/creditos");
		const region = screen.getByRole("region", {
			name: "Open-source libraries",
		});
		const groups = within(region).getAllByRole("list");
		expect(groups.map((list) => list.getAttribute("aria-label"))).toEqual([
			"Interface",
			"Data and state",
			"Engine and desktop",
			"Fonts",
		]);
		const names = groups.flatMap((list) =>
			within(list)
				.getAllByRole("link")
				.map((link) => link.textContent?.split("·")[0]?.trim()),
		);
		expect(names.sort()).toEqual(LIBRARIES.map((l) => l.name).sort());
		expect(
			within(region).getByRole("link", { name: "react · MIT" }),
		).toBeTruthy();
	});

	test("is available in Spanish", async () => {
		await renderAt("/ajustes/creditos", "es-ES");
		expect(
			screen.getByRole("heading", { level: 1, name: "Créditos" }),
		).toBeTruthy();
		expect(
			screen.getByRole("region", { name: "Fuentes de datos" }),
		).toBeTruthy();
	});
});

describe("credits data", () => {
	const workspaces = [
		"apps/desktop",
		"packages/contracts",
		"packages/core",
		"packages/i18n",
		"packages/ui-kit",
	];
	// Bundled in the installer although it is a devDependency of the app.
	const shipped = ["electron"];

	test("lists every runtime dependency and nothing else", () => {
		const runtime = new Set(shipped);
		for (const workspace of workspaces) {
			for (const name of Object.keys(
				json(`${workspace}/package.json`).dependencies ?? {},
			)) {
				if (!name.startsWith("@rift-legends/")) runtime.add(name);
			}
		}
		expect(LIBRARIES.map((library) => library.name).sort()).toEqual(
			[...runtime].sort(),
		);
	});

	test("declares the licence the installed package declares", () => {
		for (const { name, licence } of LIBRARIES) {
			const dir = workspaces.find((workspace) =>
				existsSync(join(root, workspace, "node_modules", name)),
			);
			const installed = json(`${dir}/node_modules/${name}/package.json`);
			expect([installed.license, name]).toEqual([licence, name]);
		}
	});

	test("the groups cover every library exactly once", () => {
		const grouped = LIBRARY_GROUPS.flatMap((group) =>
			LIBRARIES.filter((library) => library.group === group).map(
				(library) => library.name,
			),
		);
		expect(grouped.sort()).toEqual(LIBRARIES.map((l) => l.name).sort());
		for (const group of LIBRARY_GROUPS) {
			expect(LIBRARIES.some((library) => library.group === group)).toBe(true);
		}
	});

	test("every link is on a host the main process opens", () => {
		const urls = [
			...SOURCES.flatMap((s) => [s.url, s.licenceUrl]),
			...LIBRARIES.map((library) => library.url),
		].filter((url): url is string => url !== undefined);
		for (const url of urls) {
			expect(CREDIT_LINK_HOSTS).toContain(new URL(url).host);
		}
	});
});
