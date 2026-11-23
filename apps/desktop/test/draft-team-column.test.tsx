import type { DraftView, SeriesOptions } from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TeamColumn } from "../src/renderer/draft/board/team-column";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

const handles = {
	top: "Topa",
	jungle: "Jungo",
	mid: "Midra",
	bot: "Botto",
	support: "Suppy",
} as const;

const options = {
	teams: [
		{
			id: "forge",
			name: "Forge",
			seed: 1,
			coach: "forge-coach",
			players: Object.entries(handles).map(([role, handle]) => ({
				id: `forge-${role}`,
				role,
				handle,
				attributes: {},
			})),
		},
	],
	pool: [],
	positions: {},
	champions: [
		{ id: "toppy", name: "Toppy", roles: ["top"] },
		{ id: "middy", name: "Middy", roles: ["mid"] },
		{ id: "flexy", name: "Flexy", roles: ["mid", "top"] },
		{ id: "onlymid", name: "Onlymid", roles: ["mid"] },
		{ id: "carry", name: "Carry", roles: ["bot"] },
	],
} as unknown as SeriesOptions;

async function renderColumn(picks: string[], current: number | null = null) {
	const team: DraftView["blue"] = { team: "forge", bans: [], picks };
	await renderInLocale(
		<TeamColumn
			side="blue"
			first
			team={team}
			options={options}
			current={current}
			onPlayer={() => {}}
		/>,
	);
	return within(screen.getByRole("region", { name: "Blue side Forge" }))
		.getAllByRole("button")
		.map(visibleText);
}

/** A row's text without what screen readers skip (the champion face). */
function visibleText(row: HTMLElement) {
	const copy = row.cloneNode(true) as HTMLElement;
	for (const hidden of copy.querySelectorAll("[aria-hidden]")) hidden.remove();
	return [...copy.querySelectorAll("span, strong, small")]
		.filter((node) => node.children.length === 0 && node.textContent)
		.map((node) => node.textContent)
		.join(" ");
}

describe("draft board team column (#294)", () => {
	test("each player keeps a fixed row, top to support", async () => {
		const rows = await renderColumn([]);
		expect(rows).toEqual([
			"Pending Topa",
			"Pending Jungo",
			"Pending Midra",
			"Pending Botto",
			"Pending Suppy",
		]);
	});

	test("a mid as pick 2 lands in the mid row with its pick number and moves no player", async () => {
		const rows = await renderColumn(["toppy", "middy"]);
		expect(rows).toEqual([
			"B1 Toppy Topa",
			"Pending Jungo",
			"B2 Middy Midra",
			"Pending Botto",
			"Pending Suppy",
		]);
	});

	test("the pick being chosen shows its number in the first free row", async () => {
		const rows = await renderColumn(["middy"], 1);
		expect(rows.slice(0, 3)).toEqual([
			"B2 Your pick Topa",
			"Pending Jungo",
			"B1 Middy Midra",
		]);
	});

	test("a second pick of a taken role goes to its next role, else the first free row", async () => {
		expect(await renderColumn(["carry", "middy", "flexy", "onlymid"])).toEqual([
			"B3 Flexy Topa",
			"B4 Onlymid Jungo",
			"B2 Middy Midra",
			"B1 Carry Botto",
			"Pending Suppy",
		]);
	});
});
