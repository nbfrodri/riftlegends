import type { MapSnapshot } from "@rift-legends/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
	FaceToFace,
	type LanePlayer,
} from "../src/renderer/match/face-to-face";
import { renderInLocale } from "./render-in-locale";

const photos: Record<string, string> = {
	"b-top": "rift-asset://photos/players/b-top.png",
};
vi.mock("../src/renderer/assets", async (original) => ({
	...(await original<typeof import("../src/renderer/assets")>()),
	usePlayerPhotoSrc: (id: string) => photos[id],
}));
vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftContent: () => "real",
}));

afterEach(cleanup);

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
const render = () =>
	renderInLocale(
		<FaceToFace
			snapshot={snapshot}
			lineup={lineup}
			names={{ blue: "Forge", red: "Shoal" }}
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

test("each lane player sits in fixed tracks: photo and champion at the outer edge, name block centred", async () => {
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
	for (const cell of [...blue, ...red]) {
		const name = cell.querySelector<HTMLElement>("[data-part=name]");
		expect(name?.className).toMatch(/\btext-center\b/);
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

test("#502: K/D/A, CS and gold are 15 px tabular numbers in centred cells", async () => {
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

test("#509: stat headers give the icon room above its label, centred with even padding on both sides", async () => {
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
	expect(new Set(headers.map((th) => th.className)).size).toBe(1);
});
