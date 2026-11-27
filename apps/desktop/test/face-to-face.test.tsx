import type { MapSnapshot } from "@rift-legends/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
	FaceToFace,
	type LanePlayer,
} from "../src/renderer/match/face-to-face";
import { renderInLocale } from "./render-in-locale";

const photos: Record<string, string> = {
	"b-top": "rift-asset://photos/players/b-top.png",
};
/** Whether the official stat icons are cached; off by default (Lucide fallback). */
const cache = vi.hoisted(() => ({ stats: false }));
vi.mock("../src/renderer/assets", async (original) => ({
	...(await original<typeof import("../src/renderer/assets")>()),
	usePlayerPhotoSrc: (id: string) => photos[id],
	useAssetSrc: (source: string, path: string) =>
		cache.stats ? `rift-asset://${source}/${path}` : undefined,
}));
vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftContent: () => "real",
}));

afterEach(() => {
	cleanup();
	cache.stats = false;
});

const side = {
	gold: 0,
	kills: 0,
	towers: { top: 0, mid: 0, bot: 0 },
	nexusTowers: 0,
	inhibitors: { top: null, mid: null, bot: null },
	dragons: 0,
	soul: false,
	heralds: 0,
	grubs: 0,
	barons: 0,
	elders: 0,
	buffs: { herald: null, baron: null, elder: null },
} satisfies MapSnapshot["blue"];
const roles = ["top", "jungle", "mid", "bot", "support"];
const ids = [...roles.map((r) => `b-${r}`), ...roles.map((r) => `r-${r}`)];
const snapshot: MapSnapshot = {
	minute: 10,
	blue: side,
	red: side,
	players: ids.map((player, i) => ({
		player,
		kills: i,
		deaths: 0,
		assists: 0,
		gold: 1000 + i * 10,
		cs: 20 + i,
	})),
};
const longHandle = "Averyveryveryverylonghandlethatneverends";
const longChampion = "Needlecurrent of the endless northern sea";
const lineup = new Map<string, LanePlayer>(
	ids.map((id, i) => [
		id,
		{
			handle: i === 0 ? longHandle : `P${i}`,
			champion: `c${i}`,
			championName: i === 5 ? longChampion : `Champ ${i}`,
		},
	]),
);
/** Final vision scores, known once the game is over: 30 plus the index. */
const vision = new Map(ids.map((id, i) => [id, 30 + i]));
const render = (final?: ReadonlyMap<string, number>) =>
	renderInLocale(
		<FaceToFace
			snapshot={snapshot}
			lineup={lineup}
			names={{ blue: "Forge", red: "Shoal" }}
			vision={final}
		/>,
	);

const playerCells = (side: "blue" | "red") =>
	within(screen.getByRole("table", { name: "Face to face" }))
		.getAllByRole("row")
		.slice(2)
		.map((row) => {
			// The player is the outermost cell of the side.
			const cell = [...row.querySelectorAll(`td[data-side=${side}]`)].at(
				side === "blue" ? 0 : -1,
			);
			if (!(cell instanceof HTMLElement)) throw new Error("missing cell");
			return cell;
		});
const parts = (cell: HTMLElement) =>
	[...(cell.querySelector("[data-lane-player]")?.children ?? [])].map(
		(part) => (part as HTMLElement).dataset.part,
	);

test("each lane player sits in fixed tracks: photo and champion at the outer edge, name next to them", async () => {
	await render();
	const blue = playerCells("blue");
	const red = playerCells("red");
	expect(blue).toHaveLength(5);
	for (const cell of blue)
		expect(parts(cell)).toEqual(["photo", "champion", "name"]);
	for (const cell of red)
		expect(parts(cell)).toEqual(["name", "champion", "photo"]);
	// The same grid in every row: a long name cannot push the portraits.
	const grids = [...blue, ...red].map(
		(cell) => cell.querySelector("[data-lane-player]")?.className,
	);
	expect(new Set(grids.slice(0, 5)).size).toBe(1);
	expect(new Set(grids.slice(5)).size).toBe(1);
	expect(grids[0]).toMatch(/\bgrid\b/);
	expect(grids[0]).not.toMatch(/justify-center/);
	// #548: the «Player» header uses the same tracks as its rows.
	const playerHeaders = [
		...screen
			.getByRole("table", { name: "Face to face" })
			.querySelectorAll<HTMLElement>("thead th[scope=col]"),
	].filter((th) => th.textContent === "Player");
	expect(playerHeaders.map((th) => th.firstElementChild?.className)).toEqual([
		grids[0],
		grids[5],
	]);
	for (const [i, cell] of [...blue, ...red].entries()) {
		const name = cell.querySelector<HTMLElement>("[data-part=name]");
		// #548: next to the pictures, mirrored on red.
		expect(name?.className).toMatch(i < 5 ? /\btext-left\b/ : /\btext-right\b/);
		expect(name?.className).toMatch(/\bmin-w-0\b/);
		for (const line of name?.children ?? [])
			expect(line.className).toMatch(/\btruncate\b/);
	}
});

test("long names are cut with an ellipsis and read in full in the Caja tooltip and the accessible text", async () => {
	await render();
	const [blueTop] = playerCells("blue");
	const [redTop] = playerCells("red");
	const name = blueTop?.querySelector<HTMLElement>("[data-part=name]");
	expect(name?.dataset.tooltipHeading).toBe(longHandle);
	expect(name?.dataset.tooltip).toBe("Champ 0");
	expect(within(blueTop as HTMLElement).getByText(longHandle)).toBeTruthy();
	expect(
		redTop?.querySelector<HTMLElement>("[data-part=name]")?.dataset.tooltip,
	).toBe(longChampion);
	expect(
		within(redTop as HTMLElement).getByRole("img", { name: longChampion }),
	).toBeTruthy();
	expect(document.querySelector("[title]")).toBeNull();
});

test("each player shows their official photo, with a named silhouette as fallback", async () => {
	await render();
	const [blueTop] = playerCells("blue");
	const [, redJungle] = playerCells("red");
	const photo = within(blueTop as HTMLElement).getByRole("img", {
		name: `Portrait of ${longHandle}`,
	});
	expect(photo.tagName).toBe("IMG");
	expect(photo.getAttribute("src")).toBe(photos["b-top"]);
	fireEvent.error(photo);
	expect(
		within(blueTop as HTMLElement).getByRole("img", {
			name: `Portrait of ${longHandle}`,
		}).tagName,
	).toBe("svg");
	expect(
		within(redJungle as HTMLElement).getByRole("img", {
			name: "Portrait of P6",
		}).tagName,
	).toBe("svg");
});

test("#502: a bigger face to face, with a 48 px photo and a 28 px champion badge in fixed tracks", async () => {
	await render();
	for (const cell of [...playerCells("blue"), ...playerCells("red")]) {
		const photo = cell.querySelector<HTMLElement>(
			"[data-part=photo] [role=img], [data-part=photo] img",
		);
		expect(photo?.getAttribute("class")).toMatch(/\bh-12\b/);
		expect(photo?.getAttribute("class")).toMatch(/\bw-\[38px\]/);
		const badge = cell.querySelector<HTMLElement>("[data-part=champion]");
		expect(badge?.className).toMatch(/\[&_\[role=img\]\]:size-7\b/);
	}
	// Taller rows that grow with the window, never below the 1280×720 fit.
	const rows = within(screen.getByRole("table", { name: "Face to face" }))
		.getAllByRole("row")
		.slice(2);
	for (const row of rows)
		expect(row.className).toMatch(/\bh-\[clamp\(56px,8\.4vh,72px\)\]/);
	// Fixed stat tracks, mirrored around the lane column.
	const widths = [
		...document.querySelectorAll<HTMLElement>("colgroup col"),
	].map((col) => col.className);
	expect(widths).toEqual([
		"",
		"w-[66px]",
		"w-[44px]",
		"w-[60px]",
		"w-[80px]",
		"w-[60px]",
		"w-[44px]",
		"w-[66px]",
		"",
	]);
});

test("#502: K/D/A, CS and gold are 15 px tabular numbers", async () => {
	await render();
	const body = within(screen.getByRole("table", { name: "Face to face" }))
		.getAllByRole("row")
		.slice(2);
	for (const row of body) {
		const stats = [...row.querySelectorAll("td")].filter(
			(cell) => !cell.querySelector("[data-lane-player]"),
		);
		expect(stats).toHaveLength(6);
		for (const cell of stats) {
			expect(cell.className).toMatch(/\btabular-nums\b/);
			expect(cell.className).toMatch(/\btext-\[15px\]/);
		}
	}
});

test("#502: player names and K/D/A use the normal text colour, never the side colour", async () => {
	await render();
	const body = within(screen.getByRole("table", { name: "Face to face" }))
		.getAllByRole("row")
		.slice(2);
	for (const row of body) {
		const kda = [...row.querySelectorAll("td")].filter((cell) =>
			/^\d+\/\d+\/\d+$/.test(cell.textContent ?? ""),
		);
		expect(kda).toHaveLength(2);
		for (const cell of kda) expect(cell.className).not.toMatch(/--side/);
	}
	for (const cell of [...playerCells("blue"), ...playerCells("red")]) {
		const name = cell.querySelector<HTMLElement>("[data-part=name]");
		expect(name?.outerHTML).not.toMatch(/--side/);
		expect(name?.firstElementChild?.className).toMatch(/\btext-text\b/);
	}
});

test("#509: stat headers give the icon room above its label, with even padding on both sides", async () => {
	await render();
	const headers = [
		...screen
			.getByRole("table", { name: "Face to face" })
			.querySelectorAll<HTMLElement>("thead th[scope=col]"),
	].filter((th) => th.querySelector("svg"));
	expect(headers).toHaveLength(6);
	for (const th of headers) {
		expect(th.className).toMatch(/\bpy-1!/);
		expect(th.className).not.toMatch(/\bpy-0!/);
		const stack = th.firstElementChild as HTMLElement;
		expect(stack.className).toMatch(/\bflex-col\b/);
		expect(stack.className).toMatch(/\bgap-1\b/);
	}
	// #548: each side's headers start at the player's edge, like their figures.
	const classes = headers.map((th) => th.className);
	expect(new Set(classes.slice(0, 3)).size).toBe(1);
	expect(new Set(classes.slice(3)).size).toBe(1);
	expect(classes[0]).toMatch(/\btext-left!/);
	expect(classes[3]).toMatch(/\btext-right!/);
	const body = within(screen.getByRole("table", { name: "Face to face" }))
		.getAllByRole("row")
		.slice(2);
	for (const row of body) {
		const stats = [...row.querySelectorAll("td")].filter(
			(cell) => !cell.querySelector("[data-lane-player]"),
		);
		for (const [i, cell] of stats.entries())
			expect(cell.className).toMatch(i < 3 ? /\btext-left!/ : /\btext-right!/);
	}
});

const officialVision = "rift-asset://cdragon/stats/vision.svg";

test("#510: once the game is over, only the jungle and support rows show the vision score with the official icon", async () => {
	cache.stats = true;
	await render(vision);
	const blue = playerCells("blue");
	const red = playerCells("red");
	const shown = (cell: HTMLElement) =>
		cell.querySelector<HTMLElement>("[data-vision]");
	for (const [row, role] of roles.entries()) {
		for (const [cells, offset] of [
			[blue, 0],
			[red, 5],
		] as const) {
			const cell = cells[row] as HTMLElement;
			const value = shown(cell);
			if (role === "jungle" || role === "support") {
				expect(value?.textContent).toBe(String(30 + offset + row));
				expect(value?.querySelector("img")?.getAttribute("src")).toBe(
					officialVision,
				);
				expect(
					within(cell).getByText(`Vision ${30 + offset + row}`).className,
				).toMatch(/\bsr-only\b/);
			} else {
				expect(value).toBeNull();
			}
		}
	}
});

test("#510: without the cache the vision score uses Lucide's eye", async () => {
	await render(vision);
	const [, jungle] = playerCells("blue");
	expect(
		jungle?.querySelector("[data-vision] svg")?.getAttribute("class"),
	).toMatch(/\blucide-eye\b/);
});

test("#510: while the game plays, the final vision score is not shown", async () => {
	await render();
	expect(document.querySelector("[data-vision]")).toBeNull();
	await userEvent.setup().hover(screen.getByText("P1"));
	expect((await screen.findByRole("tooltip")).textContent).not.toMatch(
		/Vision/,
	);
});

test("#510: every player's tooltip shows their vision score with the official icon", async () => {
	cache.stats = true;
	const user = userEvent.setup();
	await render(vision);
	const names = ["P2", "P7"].map((handle) => screen.getByText(handle));
	for (const [i, name] of names.entries()) {
		await user.hover(name);
		const tooltip = await screen.findByRole("tooltip");
		await within(tooltip).findByText(`Vision ${i === 0 ? 32 : 37}`);
		expect(tooltip.querySelector("img")?.getAttribute("src")).toBe(
			officialVision,
		);
		await user.unhover(name);
	}
});

/** #531: r-top (index 5) and b-mid (index 2) are down; seconds until they respawn. */
const down = new Map([
	["r-top", 12],
	["b-mid", 1],
]);
const renderDown = (locale = "en-US") =>
	renderInLocale(
		<FaceToFace
			snapshot={snapshot}
			lineup={lineup}
			names={{ blue: "Forge", red: "Shoal" }}
			down={down}
		/>,
		locale,
	);
/** The photo and the champion badge; the countdown stays outside, at full colour. */
const pictures = (cell: HTMLElement) => {
	const dimmed = [...cell.querySelectorAll<HTMLElement>("[data-dim]")];
	expect(
		dimmed.map((el) => el.closest("[data-part]")?.getAttribute("data-part")),
	).toEqual(
		[...(cell.querySelector("[data-lane-player]")?.children ?? [])]
			.map((part) => (part as HTMLElement).dataset.part)
			.filter((part) => part !== "name"),
	);
	return dimmed.map((el) => el.className);
};

test("#531: a dead player's photo and champion are greyed, with the seconds to respawn over the photo", async () => {
	await renderDown();
	const [, , blueMid] = playerCells("blue");
	const [redTop, redJungle] = playerCells("red");
	for (const cell of [redTop, blueMid] as HTMLElement[]) {
		expect(
			cell.querySelector("[data-lane-player]")?.hasAttribute("data-dead"),
		).toBe(true);
		for (const picture of pictures(cell))
			expect(picture).toMatch(/\bgrayscale\b/);
	}
	const countdown = redTop?.querySelector<HTMLElement>("[data-respawn]");
	expect(countdown?.textContent).toBe("12");
	expect(countdown?.getAttribute("aria-hidden")).toBe("true");
	expect(countdown?.closest("[data-dim]")).toBeNull();
	// Plain text: no badge, pill or glow behind the number.
	expect(countdown?.className).not.toMatch(/\b(bg-|rounded|shadow|ring)/);
	expect(blueMid?.querySelector("[data-respawn]")?.textContent).toBe("1");
	// The living keep their colour and show no countdown.
	const alive = redJungle as HTMLElement;
	expect(
		alive.querySelector("[data-lane-player]")?.hasAttribute("data-dead"),
	).toBe(false);
	for (const picture of pictures(alive))
		expect(picture).not.toMatch(/\bgrayscale\b/);
	expect(alive.querySelector("[data-respawn]")).toBeNull();
});

test("#531: on both sides the champion badge paints over the player photo", async () => {
	await renderDown();
	// Red reverses the DOM order and the photo is positioned for the countdown,
	// so without its own layer the badge would fall behind the photo.
	for (const cell of [...playerCells("blue"), ...playerCells("red")]) {
		const badge = cell.querySelector<HTMLElement>("[data-part=champion]");
		expect(badge?.className).toMatch(/\bz-10\b/);
		expect(
			cell.querySelector<HTMLElement>("[data-part=photo]")?.className,
		).not.toMatch(/\bz-/);
	}
});

test("#531: being dead changes no track, so nothing moves", async () => {
	await renderDown();
	const grids = [...playerCells("blue"), ...playerCells("red")].map(
		(cell) => cell.querySelector("[data-lane-player]")?.className,
	);
	expect(new Set(grids.slice(0, 5)).size).toBe(1);
	expect(new Set(grids.slice(5)).size).toBe(1);
	const [redTop] = playerCells("red");
	expect(parts(redTop as HTMLElement)).toEqual(["name", "champion", "photo"]);
	// The countdown sits over the photo, out of the flow.
	expect(redTop?.querySelector("[data-respawn]")?.className).toMatch(
		/\babsolute\b/,
	);
});

test.each([
	["en-US", "dead, respawns in 12 seconds", "dead, respawns in 1 second"],
	[
		"es-ES",
		"muerto, reaparece en 12 segundos",
		"muerto, reaparece en 1 segundo",
	],
])(
	"#531: the %s screen reader hears the death and the respawn in words",
	async (locale, twelve, one) => {
		await renderDown(locale);
		expect(screen.getByText(twelve).className).toMatch(/\bsr-only\b/);
		expect(screen.getByText(one)).toBeTruthy();
	},
);

test("#531: greying in and out has no transition with reduced motion", async () => {
	await renderDown();
	const [redTop] = playerCells("red");
	for (const picture of pictures(redTop as HTMLElement))
		expect(picture).toMatch(/\bmotion-reduce:transition-none\b/);
});

test("#531: without respawn data nobody is greyed", async () => {
	await render();
	expect(document.querySelector("[data-dead]")).toBeNull();
	expect(document.querySelector("[data-respawn]")).toBeNull();
	expect(document.querySelector(".grayscale")).toBeNull();
});
