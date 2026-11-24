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
		await user.click(screen.getByRole("link", { name: "Back to Settings" }));
		expect(
			await screen.findByRole("heading", { level: 1, name: "Settings" }),
		).toBeTruthy();
	});

	test("shows the data sources with their licence and links", async () => {
		await renderAt("/ajustes/creditos");
		const sources = screen.getByRole("region", { name: "Data sources" });
		const leaguepedia = within(sources).getByRole("link", {
			name: "Leaguepedia",
		});
		expect(leaguepedia.getAttribute("href")).toBe(
			"https://lol.fandom.com/wiki/Leaguepedia",
		);
		expect(
			within(sources)
				.getByRole("link", { name: "CC BY-SA 3.0" })
				.getAttribute("href"),
		).toBe("https://creativecommons.org/licenses/by-sa/3.0/");
		for (const name of ["CommunityDragon", "lolesports.com"]) {
			expect(within(sources).getByRole("link", { name })).toBeTruthy();
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

	test("lists every open-source library with its licence", async () => {
		await renderAt("/ajustes/creditos");
		const list = screen.getByRole("list", { name: "Open-source libraries" });
		expect(within(list).getAllByRole("listitem")).toHaveLength(
			LIBRARIES.length,
		);
		const react = within(list).getByRole("link", { name: "react" });
		expect(react.closest("li")?.textContent).toContain("MIT");
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
