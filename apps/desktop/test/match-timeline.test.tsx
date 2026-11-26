import type { MapSnapshot, MatchView } from "@rift-legends/contracts";
import {
	act,
	cleanup,
	fireEvent,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readGame } from "../src/renderer/draft/result-data";
import { GameReport } from "../src/renderer/draft/result-game";
import { draftStages } from "../src/renderer/draft/stages";
import { EventFeed } from "../src/renderer/match/event-feed";
import { teamMap } from "../src/renderer/match/team-map";
import { TeamPanel } from "../src/renderer/match/team-panel";
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
	grubs: 0,
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
				vision: 40,
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
	useDraftSession: () => session,
	useSeriesOptions: () => session.options,
}));
const session = {
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
			{
				id: "forge",
				name: "Forge",
				players: [{ id: "b-top", handle: "Bluetop" }],
			},
			{
				id: "shoal",
				name: "Shoal",
				players: [{ id: "r-top", handle: "Redtop" }],
			},
		],
	},
};

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

const multikillView = () => {
	const finishingKill = {
		killer: "b-top",
		victim: "r-top",
		assists: [],
		fightSecond: 7,
		multikill: 2 as const,
	};
	const fight = {
		...event,
		kind: "fight" as const,
		causes: [...event.causes],
		kills: [
			{ killer: "b-top", victim: "r-mid", assists: [], fightSecond: 0 },
			finishingKill,
		],
	};
	const ended = match.facts.find((fact) => fact.type === "match.ended");
	if (!ended) throw new Error("missing result fixture");
	const result = {
		...ended,
		multikills: [{ event: 0, killer: "b-top", count: 2 as const }],
	};
	return {
		...match,
		facts: [match.facts[0] as (typeof match.facts)[number], fight, result],
	};
};

test.each([
	["en-US", "Double kill"],
	["es-ES", "Asesinato doble"],
])(
	"the %s event log labels the kill that completes the streak",
	async (locale, label) => {
		const teams = { blue: "Forge", red: "Shoal" };
		await renderInLocale(
			<EventFeed
				facts={multikillView().facts}
				second={12}
				names={teams}
				ids={teams}
				players={new Map()}
				ended
			/>,
			locale,
		);
		const finishingKill = screen.getByText(label).closest("[data-kill]");
		expect(finishingKill?.textContent).toContain("r-top");
	},
);

test.each([
	["en-US", "Double kill", "Double ×2, Triple"],
	["es-ES", "Asesinato doble", "Doble ×2, Triple"],
])(
	"the %s result badges the player's row with the best streak and lists them all in words",
	async (locale, label, summary) => {
		const view = multikillView();
		const result = view.facts[2] as { multikills?: unknown[] };
		result.multikills = [
			{ event: 0, killer: "b-top", count: 2 },
			{ event: 0, killer: "b-top", count: 3 },
			{ event: 0, killer: "b-top", count: 2 },
		];
		const game = readGame(view);
		if (!game) throw new Error("missing game result");
		await renderInLocale(
			<GameReport game={game} summary={undefined} showWinner />,
			locale,
		);
		expect(
			screen.queryByRole("list", { name: /ultikill|múltiples/ }),
		).toBeNull();
		const row = screen.getByText("Bluetop").closest("tr");
		const badge = within(row as HTMLElement).getByLabelText(
			new RegExp(summary.split(",")[0] as string),
		);
		expect(badge.getAttribute("aria-label")).toContain(
			summary.split(", ")[1] as string,
		);
		expect(badge.getAttribute("data-badge")).toBe("3");
		expect(label).toBeTruthy();
		const other = screen.getAllByRole("row").filter((r) => r !== row);
		for (const r of other)
			expect(within(r).queryByLabelText(/Triple/)).toBeNull();
	},
);

test("a repeated best streak shows its count in the chip", async () => {
	const view = multikillView();
	const result = view.facts[2] as { multikills?: unknown[] };
	result.multikills = [2, 2, 2].map((count) => ({
		event: 0,
		killer: "b-top",
		count,
	}));
	const game = readGame(view);
	if (!game) throw new Error("missing game result");
	await renderInLocale(
		<GameReport game={game} summary={undefined} showWinner />,
	);
	const row = screen.getByText("Bluetop").closest("tr") as HTMLElement;
	const badge = within(row).getByLabelText(/Double ×3/);
	expect(badge.getAttribute("data-badge")).toBe("2 ×3");
});

test("assisters stay on one line as icons, with their names only in words", async () => {
	const teams = { blue: "Forge", red: "Shoal" };
	const facts = [
		{
			...event,
			kind: "fight" as const,
			causes: [...event.causes],
			kills: [
				{
					killer: "b-top",
					victim: "r-top",
					assists: ["b-mid", "b-bot", "b-support"],
				},
			],
		},
	];
	await renderInLocale(
		<EventFeed
			facts={facts as never}
			second={12}
			names={teams}
			ids={teams}
			players={new Map()}
			ended
		/>,
	);
	const row = document.querySelector("[data-assists]") as HTMLElement;
	expect(row.className).toContain("flex-nowrap");
	expect(row.className).not.toMatch(/(^|\s)flex-wrap/);
	expect(row.querySelectorAll("[data-assister]")).toHaveLength(3);
});

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
	// #376: the end of the match says what it does, with no arrow icon.
	const result = screen.getByRole("button", { name: "View result" });
	expect(result.textContent).toBe("View result");
	expect(result.querySelector("svg")).toBeNull();
});

test("reveals facts at their second and updates the map and gold from the completed minute", async () => {
	await renderInLocale(<Match />, "es");
	const feed = within(
		screen.getByRole("list", { name: "Eventos de la partida" }),
	);
	advance(750);
	expect(feed.queryAllByRole("listitem")).toHaveLength(0);
	advance(250);
	expect(feed.getByText("Bluetop")).toBeTruthy();
	expect(feed.getByText("Redtop")).toBeTruthy();
	expect(feed.getByRole("img", { name: "Ember Crown" })).toBeTruthy();
	expect(feed.getByRole("img", { name: "Bright Moon" })).toBeTruthy();
	expect(feed.getByText("Dragón")).toBeTruthy();
	expect(feed.getByText(/Foso del dragón/)).toBeTruthy();
	expect(feed.getByText(/visión/i)).toBeTruthy();
	expect(feed.getByText(/future-factor/)).toBeTruthy();
	expect(feed.queryByText("Nexo")).toBeNull();
	const shoal = within(
		screen.getByRole("region", { name: "Estructuras y objetivos de Shoal" }),
	);
	const top = () => within(shoal.getByRole("row", { name: /Top/ }));
	expect(top().queryAllByLabelText("Torre destruida")).toHaveLength(0);
	expect(shoal.getByText("11 de 11")).toBeTruthy();
	advance(4000);
	expect(top().getAllByLabelText("Torre destruida")).toHaveLength(2);
	expect(top().getByLabelText("Inhibidor destruido")).toBeTruthy();
	expect(top().getByText("02:00")).toBeTruthy();
	expect(shoal.getByText("9 de 11")).toBeTruthy();
	expect(screen.getByText("+3.200 oro")).toBeTruthy();
	const forge = within(
		screen.getByRole("region", { name: "Estructuras y objetivos de Forge" }),
	);
	expect(forge.getByText("11 de 11")).toBeTruthy();
	expect(forge.getByText("3 de 4")).toBeTruthy();
	expect(
		within(forge.getByRole("list", { name: "Efectos activos" }))
			.getAllByRole("listitem")
			.map((item) => item.textContent),
	).toContain("Barón 02:00");
	expect(shoal.getByText("Sin efectos activos")).toBeTruthy();
});

test("each team's panel shows its own structures and objectives in its colour", async () => {
	await renderInLocale(<Match />);
	advance(5000);
	for (const [team, side] of [
		["Forge", "blue"],
		["Shoal", "red"],
	] as const) {
		const panel = screen.getByRole("region", {
			name: `${team} structures and objectives`,
		});
		expect(panel.getAttribute("data-side")).toBe(side);
		expect(within(panel).getByRole("heading", { name: team })).toBeTruthy();
		const table = within(panel).getByRole("table");
		for (const icon of within(table).getAllByLabelText(/^Standing /)) {
			expect(icon.classList.contains("text-(--side)")).toBe(true);
			expect(icon.querySelector("svg")?.classList.contains("size-6")).toBe(
				true,
			);
		}
		for (const name of ["Lane", "Outer", "Inner", "Base", "Inhibitor"])
			expect(within(table).getByRole("columnheader", { name })).toBeTruthy();
		expect(within(table).getAllByRole("row")).toHaveLength(5);
	}
	const forge = within(
		screen.getByRole("region", { name: "Forge structures and objectives" }),
	);
	expect(forge.queryAllByLabelText(/Destroyed/)).toHaveLength(0);
	// Each term is followed by its value.
	const objective = (name: string) =>
		forge.getByText(name).closest("dt")?.nextElementSibling?.textContent;
	expect(objective("Dragons")).toBe("3 of 4");
	expect(objective("Heralds")).toBe("0");
	expect(objective("Barons")).toBe("1");
	expect(objective("Elders")).toBe("0");
});

test("destroyed structures have a visible strike in addition to their label", async () => {
	await renderInLocale(<Match />);
	advance(5000);
	const struck = (label: string) => {
		for (const icon of screen.getAllByLabelText(label)) {
			expect(icon.getAttribute("role")).toBe("img");
			expect(icon.classList.contains("after:-rotate-45")).toBe(true);
		}
	};
	struck("Destroyed tower");
	struck("Destroyed inhibitor");
	click("Skip to end");
	struck("Destroyed nexus");
});

test.each(["blue", "red"] as const)(
	"active effects inherit the %s side colour",
	async (owner) => {
		const view = teamMap(
			{ ...side, soul: true, buffs: { ...side.buffs, baron: 3 } },
			60,
		);
		await renderInLocale(<TeamPanel side={owner} name="Team" view={view} />);
		const effects = screen.getByRole("list", { name: "Active effects" });
		expect(effects.closest("[data-side]")?.getAttribute("data-side")).toBe(
			owner,
		);
		expect(within(effects).getByText("Dragon soul")).toBeTruthy();
		expect(
			within(effects)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toContain("Baron 02:00");
		expect(effects.classList.contains("text-(--side)")).toBe(true);
	},
);

test("skipping reveals the last partial minute and waits for the result button", async () => {
	await renderInLocale(<Match />);
	click("Skip to end");
	expect(clock()).toBe("01:18");
	expect(screen.getByText("Dragon soul")).toBeTruthy();
	expect(screen.getByText("5,100 gold")).toBeTruthy();
	const shoal = within(
		screen.getByRole("region", { name: "Shoal structures and objectives" }),
	);
	const nexus = within(shoal.getByRole("row", { name: /Nexus/ }));
	expect(nexus.getAllByLabelText("Destroyed tower")).toHaveLength(2);
	expect(nexus.getByLabelText("Destroyed nexus")).toBeTruthy();
	expect(shoal.getByText("9 of 11")).toBeTruthy();
	const forge = within(
		screen.getByRole("region", { name: "Forge structures and objectives" }),
	);
	expect(
		within(forge.getByRole("row", { name: /Nexus/ })).getByLabelText(
			"Standing nexus",
		),
	).toBeTruthy();
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
			expect(header.querySelector("svg")?.getAttribute("width")).toBe("18");
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

test("face to face mirrors each role: blue on the left, the role in the centre, red on the right", async () => {
	await renderInLocale(<Match />);
	faceToFace();
	advance(5000);
	const table = screen.getByRole("table", { name: "Face to face" });
	const headers = within(table)
		.getAllByRole("columnheader")
		.slice(-9)
		.map((header) => header.textContent);
	expect(headers).toEqual([
		"Player",
		"K/D/A",
		"CS",
		"Gold",
		"Lane",
		"Gold",
		"CS",
		"K/D/A",
		"Player",
	]);
	for (const role of ["Top", "Jungle", "Mid", "ADC", "Support"]) {
		const row = within(table).getByRole("row", { name: new RegExp(role) });
		const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
		expect(cells).toHaveLength(9);
		expect(cells[4]?.getAttribute("scope")).toBe("row");
		expect(cells[4]?.textContent).toContain(role);
		expect(cells[0]?.getAttribute("data-side")).toBe("blue");
		expect(cells[8]?.getAttribute("data-side")).toBe("red");
	}
	const top = [
		...(lane("Top").getByRole("rowheader").closest("tr")?.children ?? []),
	];
	expect(top[0]?.textContent).toContain("Ember Crown");
	expect(top[1]?.textContent).toBe("1/0/2");
	expect(top[3]?.textContent).toBe("1,500");
	expect(top[5]?.textContent).toBe("1,200");
	expect(top[7]?.textContent).toBe("0/1/0");
	expect(top[8]?.textContent).toContain("Silver Tide");
});

test("each role's gold lead is a bar that grows towards the side ahead", async () => {
	await renderInLocale(<Match />);
	faceToFace();
	advance(5000);
	const bar = (role: string) =>
		lane(role).getByRole("rowheader").querySelector("[data-gold-lead]");
	expect(bar("Top")?.getAttribute("data-side")).toBe("blue");
	expect(bar("Jungle")?.getAttribute("data-side")).toBe("red");
	// Half the row is the biggest lead of the minute, at least 1,000 gold.
	expect((bar("Jungle") as HTMLElement).style.width).toBe("25%");
	expect((bar("Top") as HTMLElement).style.width).toBe("15%");
	expect(bar("Mid")).toBeNull();
});

const chartLabels = () =>
	[...screen.getByRole("figure").querySelectorAll("[data-axis]")].map(
		(label) => label.textContent,
	);

test("the gold chart scales to the gold difference, with a minimum range", async () => {
	await renderInLocale(<Match />);
	expect(chartLabels()).toEqual(["2,000", "0", "2,000"]);
	advance(5000);
	// A 3,200 lead rounds the range up to the next thousand.
	expect(chartLabels()).toEqual(["4,000", "0", "4,000"]);
	const line = screen.getByRole("figure").querySelector("[data-lead-line]");
	expect(line?.getAttribute("d")).toMatch(/ 10$/);
	expect(
		screen.getByRole("img", { name: /Gold lead over time.*\+3,200 gold/ }),
	).toBeTruthy();
});

test("face to face shows each player's portrait and name, with the champion as secondary text", async () => {
	await renderInLocale(<Match />);
	faceToFace();
	advance(5000);
	const cells = [
		...(lane("Top").getByRole("rowheader").closest("tr")?.children ?? []),
	] as HTMLElement[];
	for (const [cell, player, champion] of [
		[cells[0], "Bluetop", "Ember Crown"],
		[cells[8], "Redtop", "Silver Tide"],
	] as const) {
		if (!cell) throw new Error("missing cell");
		expect(within(cell).getByRole("img", { name: champion })).toBeTruthy();
		expect(within(cell).getByText(player)).toBeTruthy();
		expect(within(cell).getByText(champion)).toBeTruthy();
	}
	// The pictures sit on the outer edge, mirrored (#433).
	const order = (cell: Element | undefined) =>
		[...(cell?.querySelector("[data-lane-player]")?.children ?? [])].map(
			(part) => (part as HTMLElement).dataset.part,
		);
	expect(order(cells[0])).toEqual(["photo", "champion", "name"]);
	expect(order(cells[8])).toEqual(["name", "champion", "photo"]);
});

test.each([
	[
		"en-US",
		[
			"First blood",
			"Solo kill",
			"Killing spree",
			"Rampage",
			"Shutdown worth 150 gold",
			"Ace",
			"outsmited the opposition",
			"snatched it from the pit",
		],
	],
	[
		"es-ES",
		[
			"Primera sangre",
			"Baja en solitario",
			"En racha",
			"Dominando",
			"Corta la racha y gana 150 de oro",
			"Exterminio",
			"ganó el duelo de Aplastar",
			"arrebató el objetivo en el foso",
		],
	],
] as const)(
	"the %s event log shows special plays and varies steal text",
	async (locale, labels) => {
		const teams = { blue: "Forge", red: "Shoal" };
		const steal = {
			jungler: "b-jungle",
			controllingSide: "red" as const,
			defenders: 3,
			opposingSmite: true,
		};
		const facts = [
			{ ...event, second: 12, steal, kills: [], causes: [] },
			{ ...event, second: 13, steal, kills: [], causes: [] },
			{
				...event,
				second: 10,
				kind: "lane" as const,
				zone: "lane-top" as const,
				causes: [],
				kills: [
					{
						killer: "b-top",
						victim: "r-top",
						assists: [],
						soloKill: true as const,
						firstBlood: { killerGold: 100, assistGold: 0 },
					},
				],
			},
			{
				...event,
				kind: "fight" as const,
				second: 14,
				causes: [],
				kills: [
					{ killer: "b-top", victim: "r-mid", assists: [], spree: 3 as const },
					{
						killer: "b-top",
						victim: "r-top",
						assists: [],
						spree: 4 as const,
						shutdown: 150,
						ace: true as const,
					},
				],
			},
		];
		await renderInLocale(
			<EventFeed
				facts={facts}
				second={14}
				names={teams}
				ids={teams}
				players={new Map()}
				ended
			/>,
			locale,
		);
		for (const label of labels)
			expect(screen.getByText(label, { exact: false })).toBeTruthy();
		expect(
			screen.getByText(labels[0]).closest("[data-kill]")?.textContent,
		).toContain("b-top");
		expect(screen.getByText(labels[6], { exact: false }).textContent).toContain(
			"b-jungle",
		);
	},
);
