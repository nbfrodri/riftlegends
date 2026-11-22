import type { MapSnapshot, MatchView } from "@rift-legends/contracts";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { draftStages } from "../src/renderer/draft/stages";
import { renderInLocale } from "./render-in-locale";

const present = vi.fn();
const side = {
	gold: 0,
	kills: 0,
	towers: { top: 0, mid: 0, bot: 0 },
	nexusTowers: 0,
	inhibitors: { top: null, mid: null, bot: null },
	dragons: 0,
	soul: false,
	heralds: 0,
	barons: 0,
	elders: 0,
	buffs: { herald: null, baron: null, elder: null },
} satisfies MapSnapshot["blue"];
const event = {
	type: "match.event",
	game: 1,
	minute: 1,
	second: 12,
	kind: "dragon",
	side: "blue",
	zone: "dragon-pit",
	kills: [],
	gold: { blue: 30, red: 0 },
	chance: 5000,
	causes: [
		{ key: "vision", points: 15 },
		{ key: "future-factor", points: 10 },
	],
} as const;
const profile = {
	phases: { early: 0, mid: 0, late: 0 },
	contests: { lane: 0, jungle: 0, fight: 0, objective: 0, siege: 0 },
};
const line = (
	player: string,
	[kills, deaths, assists]: [number, number, number],
	gold: number,
	cs: number,
) => ({ player, kills, deaths, assists, gold, cs });
const lanes = ["top", "jungle", "mid", "bot", "support"];
const roster = (
	blue: ReturnType<typeof line>[],
	red: ReturnType<typeof line>[],
) => [...blue, ...red];
const minuteOne = roster(
	[
		line("b-top", [1, 0, 2], 1500, 40),
		line("b-jungle", [0, 0, 1], 900, 20),
		line("b-mid", [0, 0, 0], 1000, 30),
		line("b-bot", [1, 0, 0], 1100, 35),
		line("b-support", [0, 0, 2], 600, 5),
	],
	[
		line("r-top", [0, 1, 0], 1200, 22),
		line("r-jungle", [0, 0, 0], 1400, 18),
		line("r-mid", [0, 0, 0], 1000, 30),
		line("r-bot", [0, 0, 0], 1100, 30),
		line("r-support", [0, 0, 1], 600, 5),
	],
);
const minuteTwo = roster(
	[
		line("b-top", [2, 0, 3], 2500, 50),
		line("b-jungle", [0, 0, 1], 1700, 40),
		line("b-mid", [1, 0, 0], 2000, 60),
		line("b-bot", [1, 0, 0], 1900, 55),
		line("b-support", [0, 0, 4], 1200, 9),
	],
	[
		line("r-top", [0, 2, 0], 1400, 40),
		line("r-jungle", [0, 0, 0], 1500, 38),
		line("r-mid", [0, 0, 0], 1000, 30),
		line("r-bot", [0, 0, 0], 1100, 30),
		line("r-support", [0, 0, 1], 600, 5),
	],
);
const match: MatchView = {
	game: 1,
	facts: [
		{
			type: "match.started",
			game: 1,
			blue: "forge",
			red: "shoal",
			profiles: { blue: profile, red: profile },
		},
		{
			...event,
			causes: [...event.causes],
			kills: [{ killer: "b-top", victim: "r-top", assists: ["b-mid"] }],
		},
		{
			...event,
			minute: 2,
			second: 18,
			kind: "nexus",
			zone: "base-red",
			causes: [],
			kills: [],
		},
		{
			type: "match.ended",
			game: 1,
			winner: "forge",
			duration: 78,
			players: [
				["b-top", "c1"],
				["r-top", "c2"],
				["b-mid", "c3"],
			].map(([player, champion]) => ({
				player: player as string,
				champion: champion as string,
				team: player === "r-top" ? "shoal" : "forge",
				kills: 0,
				deaths: 0,
				assists: 0,
				gold: 0,
				damage: 0,
				participation: 0,
				rating: 50,
			})),
			decisive: [],
		},
	],
	snapshots: [
		{ minute: 0, blue: side, red: side, players: [] },
		{
			minute: 1,
			blue: {
				...side,
				gold: 3200,
				kills: 2,
				dragons: 3,
				barons: 1,
				buffs: { ...side.buffs, baron: 3 },
			},
			red: {
				...side,
				towers: { top: 2, mid: 0, bot: 0 },
				inhibitors: { top: 3, mid: null, bot: null },
			},
			players: minuteOne,
		},
		{
			minute: 2,
			blue: { ...side, gold: 5100, kills: 4, dragons: 4, soul: true },
			red: { ...side, nexusTowers: 2 },
			players: minuteTwo,
		},
	],
};
vi.mock("../src/renderer/core", async (original) => ({
	...(await original<typeof import("../src/renderer/core")>()),
	useCoreQuery: () => ({ data: match }),
}));
vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftSession: () => ({
		view: {
			game: 1,
			phase: "over",
			wins: [1, 0],
			blue: { team: "forge" },
			red: { team: "shoal" },
		},
		mine: "forge",
		presentation: "match",
		present,
		sessionId: 1,
		options: {
			champions: [
				{ id: "c2", name: "Silver Tide" },
				{ id: "c1", name: "Ember Crown" },
				{ id: "c3", name: "Bright Moon" },
			],
			teams: [
				{ id: "forge", name: "Forge" },
				{ id: "shoal", name: "Shoal" },
			],
		},
	}),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const click = (name: string) =>
	fireEvent.click(screen.getByRole("button", { name }));
const clock = () => screen.getByRole("timer").textContent;
const Match = draftStages.match;

test("one minute takes five seconds at normal speed, with pause and both faster speeds", async () => {
	await renderInLocale(<Match />);
	expect(clock()).toBe("00:00");
	advance(1000);
	expect(clock()).toBe("00:12");
	click("Pause");
	advance(2000);
	expect(clock()).toBe("00:12");
	fireEvent.click(screen.getByRole("radio", { name: "×4" }));
	click("Resume");
	advance(250);
	expect(clock()).toBe("00:24");
	fireEvent.click(screen.getByRole("radio", { name: "×16" }));
	advance(250);
	expect(clock()).toBe("01:12");
	advance(250);
	expect(clock()).toBe("01:18");
	expect(screen.getByRole("button", { name: "View result" })).toBeTruthy();
});

test("reveals facts at their second and updates the map and gold from the completed minute", async () => {
	await renderInLocale(<Match />, "es");
	const feed = within(
		screen.getByRole("list", { name: "Eventos de la partida" }),
	);
	advance(750);
	expect(feed.queryAllByRole("listitem")).toHaveLength(0);
	advance(250);
	expect(feed.getByText(/Ember Crown.*Silver Tide/)).toBeTruthy();
	expect(feed.getByText(/Bright Moon/)).toBeTruthy();
	expect(feed.getByText("Dragón")).toBeTruthy();
	expect(feed.getByText(/Foso del dragón/)).toBeTruthy();
	expect(feed.getByText(/visión/i)).toBeTruthy();
	expect(feed.getByText(/future-factor/)).toBeTruthy();
	expect(feed.queryByText("Nexo")).toBeNull();
	const top = within(screen.getByRole("row", { name: /Top/ }));
	expect(top.queryAllByTitle("Torre destruida")).toHaveLength(0);
	advance(4000);
	expect(top.getAllByTitle("Torre destruida")).toHaveLength(2);
	expect(top.getByText("02:00")).toBeTruthy();
	expect(screen.getByText("+3.200 oro")).toBeTruthy();
	expect(screen.getByText("3 de 4")).toBeTruthy();
	expect(
		within(screen.getByRole("row", { name: /Barones/ })).getByText("02:00"),
	).toBeTruthy();
});

test("skipping reveals the last partial minute and waits for the result button", async () => {
	await renderInLocale(<Match />);
	click("Skip to end");
	expect(clock()).toBe("01:18");
	expect(screen.getByText("Dragon soul")).toBeTruthy();
	expect(screen.getByText("5,100 gold")).toBeTruthy();
	expect(screen.getByText("0 standing")).toBeTruthy();
	expect(
		screen
			.getAllByRole("listitem")
			.some((item) => item.textContent?.includes("Nexus")),
	).toBe(true);
	expect(present).not.toHaveBeenCalledWith("result");
	click("View result");
	expect(present).toHaveBeenCalledWith("result");
});

test("opens at the final snapshot with reduced motion", async () => {
	const media = window.matchMedia("(prefers-reduced-motion: reduce)");
	vi.spyOn(media, "matches", "get").mockReturnValue(true);
	vi.spyOn(window, "matchMedia").mockReturnValue(media);
	await renderInLocale(<Match />);
	expect(clock()).toBe("01:18");
	expect(screen.getByText("Dragon soul")).toBeTruthy();
});

const faceToFace = () =>
	fireEvent.click(screen.getByRole("radio", { name: "Face to face" }));
const lane = (name: string, table = "Face to face") =>
	within(
		within(screen.getByRole("table", { name: table })).getByRole("row", {
			name: new RegExp(name),
		}),
	);

test("face to face shows each lane's numbers for the current minute and advances with playback", async () => {
	await renderInLocale(<Match />);
	faceToFace();
	const table = screen.getByRole("table", { name: "Face to face" });
	for (const name of ["K/D/A", "CS", "Gold"]) {
		for (const header of within(table).getAllByRole("columnheader", { name })) {
			expect(header.querySelector("svg")).toBeTruthy();
		}
	}
	advance(5000);
	expect(within(table).getAllByRole("row")).toHaveLength(lanes.length + 2);
	let top = lane("Top");
	expect(top.getByText("Ember Crown")).toBeTruthy();
	expect(top.getByText("Silver Tide")).toBeTruthy();
	expect(top.getByText("1/0/2")).toBeTruthy();
	expect(top.getByText("0/1/0")).toBeTruthy();
	expect(top.getByText("1,500")).toBeTruthy();
	expect(top.getByText("22")).toBeTruthy();
	advance(5000);
	top = lane("Top");
	expect(top.getByText("2/0/3")).toBeTruthy();
	expect(top.getByText("1,400")).toBeTruthy();
	expect(top.getByText("40")).toBeTruthy();
});

test("face to face says who is ahead, with signed gold and CS in words, with the leader's colour", async () => {
	await renderInLocale(<Match />);
	faceToFace();
	advance(5000);
	const top = lane("Top");
	const text = top.getByText("Forge: +300 gold and 18 CS more");
	expect(text.closest("[data-side]")?.getAttribute("data-side")).toBe("blue");
	const jungle = lane("Jungle");
	expect(
		jungle
			.getByText("Shoal: +500 gold")
			.closest("[data-side]")
			?.getAttribute("data-side"),
	).toBe("red");
	expect(jungle.getByText(/Forge: 2 CS more/)).toBeTruthy();
});

test("face to face says even when a lane is tied", async () => {
	await renderInLocale(<Match />, "es");
	fireEvent.click(screen.getByRole("radio", { name: "Cara a cara" }));
	advance(5000);
	expect(lane("Mid", "Cara a cara").getByText("Igualados")).toBeTruthy();
	expect(
		lane("Top", "Cara a cara").getByText("Forge: +300 oro y 18 CS más"),
	).toBeTruthy();
});
