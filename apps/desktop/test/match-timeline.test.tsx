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
		{ ...event, causes: [...event.causes], kills: [] },
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
			players: [],
			decisive: [],
		},
	],
	snapshots: [
		{ minute: 0, blue: side, red: side },
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
		},
		{
			minute: 2,
			blue: { ...side, gold: 5100, kills: 4, dragons: 4, soul: true },
			red: { ...side, nexusTowers: 2 },
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
	expect(screen.getByText("3.200 de oro más")).toBeTruthy();
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
