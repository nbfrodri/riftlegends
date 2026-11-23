import type { AssetStatus, ChampionCatalog } from "@rift-legends/contracts";
import { loadRealContent } from "@rift-legends/core";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { DraftScreen } from "../src/renderer/draft/draft-screen";
import type { CoreCommand } from "../src/shared/bridge";
import { renderWithDraftCore, seedNextSeries } from "./draft-core";
import { fakeAssets, testCatalog } from "./fake-assets";

afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;

const real = loadRealContent();
const realIds = real.draft.champions.map((c) => c.id);
const ready: AssetStatus = { state: "ready", version: "16.23" };

const radio = (name: string) =>
	screen.getByRole("radio", { name }) as HTMLInputElement;

async function setup(
	status: AssetStatus = ready,
	catalog: ChampionCatalog | null = testCatalog(realIds),
	locale = "en-US",
) {
	const assets = fakeAssets(status, catalog);
	const core = await renderWithDraftCore(
		<DraftScreen />,
		locale,
		undefined,
		undefined,
		{ assets: assets.api },
	);
	await screen.findByRole("heading", { level: 1 });
	return { ...core, assets };
}

async function chooseReal(user: User, name = "Real LoL") {
	await waitFor(() => expect(radio(name).disabled).toBe(false));
	await user.click(radio(name));
	await waitFor(() =>
		expect(
			screen.getByRole("combobox", { name: /My team|Mi equipo/ }).textContent,
		).not.toContain("Forge"),
	);
}

/** Real teams by seed, as the setup pairs them by default. */
const bySeed = real.match.teams.slice().sort((a, b) => a.seed - b.seed);

describe("content choice (plan 11, A1)", () => {
	test("offers fictional and real content, fictional by default", async () => {
		await setup();
		expect(radio("Fictional").checked).toBe(true);
		expect(radio("Real LoL").checked).toBe(false);
	});

	test.each([
		[
			{ state: "missing" },
			"Real LoL needs the game content: download it in Settings.",
		],
		[
			{ state: "syncing", progress: { completed: 3, total: 10 } },
			"Real LoL will be available when the content download finishes.",
		],
		[
			{ state: "error" },
			"The content download failed: retry it in Settings to play real LoL.",
		],
	] as const)(
		"disables real content while the cache is %j, saying why",
		async (status, reason) => {
			await setup(status, null);
			expect(radio("Real LoL").disabled).toBe(true);
			expect(await screen.findByText(reason)).toBeTruthy();
		},
	);

	test("disables real content when the cache lacks some of its champions", async () => {
		await setup(ready, testCatalog(realIds.slice(1)));
		expect(
			await screen.findByText(
				"The downloaded content lacks some champions: update it in Settings.",
			),
		).toBeTruthy();
		expect(radio("Real LoL").disabled).toBe(true);
	});

	test("blocks a selected real series during a refresh and checks the replacement catalog", async () => {
		const user = userEvent.setup();
		const { assets } = await setup();
		await chooseReal(user);
		const start = screen.getByRole("button", {
			name: "Start series",
		}) as HTMLButtonElement;
		act(() => assets.progress({ completed: 0, total: 8 }));
		expect(start.disabled).toBe(true);
		expect(
			screen.getByText(
				"Real LoL will be available when the content download finishes.",
			),
		).toBeTruthy();
		assets.api.champions.mockResolvedValue(testCatalog(realIds.slice(1)));
		assets.finish({ state: "ready", version: "16.24" });
		await screen.findByText(
			"The downloaded content lacks some champions: update it in Settings.",
			{},
			{ timeout: 2500 },
		);
		expect(start.disabled).toBe(true);
		await user.click(radio("Fictional"));
		expect(start.disabled).toBe(false);
	});

	test("is translated to Spanish", async () => {
		await setup({ state: "missing" }, null, "es-ES");
		expect(radio("Ficticio").checked).toBe(true);
		expect(radio("LoL real").disabled).toBe(true);
		expect(
			screen.getByText(
				"LoL real necesita el contenido del juego: descárgalo en Ajustes.",
			),
		).toBeTruthy();
	});
});

describe("real teams (plan 11, A2)", () => {
	test("pairs the two best seeds and groups the snapshot teams by league", async () => {
		const user = userEvent.setup();
		await setup();
		await chooseReal(user);
		const mine = screen.getByRole("combobox", { name: "My team" });
		expect(mine.textContent).toContain(bySeed[0]?.name);
		expect(
			screen.getByRole("combobox", { name: "Rival team" }).textContent,
		).toContain(bySeed[1]?.name);
		await user.click(mine);
		await screen.findByRole("combobox", { name: "Search team" });
		const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];
		const sizes = leagues.map(
			(league) =>
				within(screen.getByRole("group", { name: league })).getAllByRole(
					"option",
				).length,
		);
		expect(sizes).toEqual(
			leagues.map(
				(league) => bySeed.filter((team) => team.league === league).length,
			),
		);
	});

	test("shows the downloaded league logo in its team selector heading", async () => {
		const user = userEvent.setup();
		const { assets } = await setup();
		await chooseReal(user);
		const url = "rift-asset://leagues/leagues/cblol.png";
		assets.api.leagueLogos.mockResolvedValue({ CBLOL: url });
		await act(async () => assets.logosChanged());
		await user.click(screen.getByRole("combobox", { name: "My team" }));
		const group = await screen.findByRole("group", { name: "CBLOL" });
		expect(group.querySelector("img")?.getAttribute("src")).toBe(url);
	});

	test("finds a team by typing part of its name", async () => {
		const user = userEvent.setup();
		await setup();
		await chooseReal(user);
		const target = real.match.teams.find((t) => t.league === "CBLOL");
		if (!target) throw new Error("no CBLOL team");
		await user.click(screen.getByRole("combobox", { name: "My team" }));
		await user.type(
			await screen.findByRole("combobox", { name: "Search team" }),
			target.name.slice(0, 6),
		);
		await user.click(
			screen.getByRole("option", {
				name: (name) => name.startsWith(target.name),
			}),
		);
		expect(
			screen.getByRole("combobox", { name: "My team" }).textContent,
		).toContain(target.name);
	});

	test("starts the series with the real content and its teams", async () => {
		const user = userEvent.setup();
		const core = await setup();
		await chooseReal(user);
		await user.click(screen.getByRole("button", { name: "Start series" }));
		await screen.findByRole("heading", { level: 1, name: "Side and order" });
		const start = core.sent.find(
			(c) => c.kind === "series.start",
		) as CoreCommand;
		expect(start.payload).toMatchObject({
			content: "real",
			teams: [bySeed[0]?.id, bySeed[1]?.id],
		});
		expect((start.payload as { pool: string[] }).pool).toEqual(realIds);
	});
});

describe("real champions on the board (R4, A3)", () => {
	async function toBoard(
		user: User,
		locale = "en-US",
		photos: Record<string, string> = {},
	) {
		const { assets } = await setup(ready, testCatalog(realIds), locale);
		// Main emits this when the photos finish downloading.
		assets.api.playerPhotos.mockResolvedValue(photos);
		act(() => assets.photosChanged());
		seedNextSeries();
		await chooseReal(user, locale === "en-US" ? "Real LoL" : "LoL real");
		await user.click(
			screen.getByRole("button", {
				name: locale === "en-US" ? "Start series" : "Empezar serie",
			}),
		);
		await user.click(
			await screen.findByRole("button", {
				name: locale === "en-US" ? "Confirm choice" : "Confirmar decisión",
			}),
		);
		await user.click(
			await screen.findByRole("button", {
				name: locale === "en-US" ? "Go to draft" : "Ir al draft",
			}),
		);
	}

	const pool = (label: string) =>
		within(screen.getByRole("group", { name: label }));

	test.each([
		["en-US", "Champions", "EN"],
		["es-ES", "Campeones", "ES"],
	])(
		"names the champions from the cache in the UI language (%s)",
		async (locale, label, suffix) => {
			const user = userEvent.setup();
			await toBoard(user, locale);
			const [first] = realIds;
			expect(
				await pool(label).findByRole("button", { name: `${first} ${suffix}` }),
			).toBeTruthy();
		},
	);

	test("shows the cached tile art in large slots and the icon in small ones", async () => {
		const user = userEvent.setup();
		await toBoard(user);
		const [first] = realIds;
		const tile = await pool("Champions").findByRole("button", {
			name: `${first} EN`,
		});
		const art = tile.querySelector("img");
		expect(art?.getAttribute("src")).toBe(
			`rift-asset://cdragon/tiles/${first}.jpg`,
		);
		fireEvent.error(art as HTMLImageElement);
		expect(tile.querySelector("img")?.getAttribute("src")).toBe(
			`rift-asset://cdragon/champions/${first}.png`,
		);
		fireEvent.contextMenu(tile);
		const card = await screen.findByRole("region", {
			name: `Champion card: ${first} EN`,
		});
		expect(card.querySelector("img")?.getAttribute("src")).toBe(
			`rift-asset://cdragon/champions/${first}.png`,
		);
	});

	test("marks the attributes the snapshot estimates on the player card", async () => {
		const user = userEvent.setup();
		await toBoard(user);
		const team = bySeed[0];
		const mid = real.draft.players.find(
			(p) => p.team === team?.id && p.role === "mid" && !p.sub,
		);
		const card = screen.getByRole("group", { name: /Player card/ });
		const marks = card.querySelectorAll("dd.italic");
		expect(marks).toHaveLength(mid?.estimated?.length ?? 0);
		expect(marks.length).toBeGreaterThan(0);
		expect(
			within(card).getByText(
				"Estimated value: it cannot be measured with stats",
			),
		).toBeTruthy();
	});

	const mid = real.draft.players.find(
		(p) => p.team === bySeed[0]?.id && p.role === "mid" && !p.sub,
	);

	test("shows the real player's cached photo and falls back to a named silhouette on error", async () => {
		const photo = "rift-asset://photos/players/mid.png";
		const user = userEvent.setup();
		await toBoard(user, "en-US", { [mid?.id ?? ""]: photo });
		const card = screen.getByRole("group", { name: /Player card/ });
		await user.click(within(card).getByText("Player card", { exact: true }));
		const portrait = await within(card).findByRole("img", {
			name: `Portrait of ${mid?.handle}`,
		});
		expect(portrait.tagName).toBe("IMG");
		expect(portrait.getAttribute("src")).toBe(photo);
		fireEvent.error(portrait);
		expect(
			within(card).getByRole("img", { name: `Portrait of ${mid?.handle}` })
				.tagName,
		).toBe("svg");
	});

	test("shows an accessible silhouette when the real player has no photo", async () => {
		const user = userEvent.setup();
		await toBoard(user);
		const card = screen.getByRole("group", { name: /Player card/ });
		await user.click(within(card).getByText("Player card", { exact: true }));
		expect(
			within(card).getByRole("img", { name: `Portrait of ${mid?.handle}` })
				.tagName,
		).toBe("svg");
	});
});
