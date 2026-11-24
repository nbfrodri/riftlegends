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

test.each(["blue", "red"] as const)(
	"keeps all five %s picks with the locking players",
	async (side) => {
		const picks = ["carry", "middy", "flexy", "onlymid", "toppy"];
		const team: DraftView["blue"] = { team: "forge", bans: [], picks };
		await renderInLocale(
			<TeamColumn
				side={side}
				first
				team={team}
				options={options}
				current={null}
				onPlayer={() => {}}
			/>,
		);
		const rows = within(screen.getByRole("region")).getAllByRole("button");
		expect(rows.map((row) => row.dataset.cardChampion)).toEqual(picks);
		for (const [index, row] of rows.entries()) {
			expect(row.textContent).toContain(Object.values(handles)[index]);
			expect(row.textContent).toContain(
				(side === "blue" ? "B" : "R") + (index + 1),
			);
			const name =
				options.champions.find((c) => c.id === picks[index])?.name ?? "";
			expect(within(row).getByRole("img", { name })).toBeTruthy();
			expect(row.textContent).not.toContain(name);
		}
	},
);

describe("#436: fixed ban slots", () => {
	const renderBans = (
		bans: (string | null)[],
		banning = false,
	): Promise<unknown> =>
		renderInLocale(
			<TeamColumn
				side="blue"
				first
				team={{ team: "forge", bans, picks: [] }}
				options={options}
				current={null}
				banning={banning}
				onPlayer={() => {}}
			/>,
		);
	const slots = () =>
		within(screen.getByRole("list", { name: "Bans" })).getAllByRole("listitem");

	test("shows five empty slots from the start, three then two", async () => {
		await renderBans([]);
		const all = slots();
		expect(all.map((slot) => slot.dataset.banSlot)).toEqual(
			Array(5).fill("empty"),
		);
		expect(all.map((slot) => slot.dataset.banPhase)).toEqual([
			"1",
			"1",
			"1",
			"2",
			"2",
		]);
		expect(all[0]?.textContent).toBe("Pending");
	});

	test("each ban fills the next slot and the size does not change", async () => {
		await renderBans(["toppy", "middy"]);
		const all = slots();
		expect(all).toHaveLength(5);
		expect(all.map((slot) => slot.dataset.banSlot)).toEqual([
			"banned",
			"banned",
			"empty",
			"empty",
			"empty",
		]);
		expect(within(all[1] as HTMLElement).getByRole("img", { name: "Middy" }));
	});

	test("marks the slot of the active ban turn, and only while banning", async () => {
		await renderBans(["toppy"], true);
		expect(slots().map((slot) => slot.getAttribute("aria-current"))).toEqual([
			null,
			"step",
			null,
			null,
			null,
		]);
		cleanup();
		await renderBans(["toppy"]);
		expect(slots().some((slot) => slot.hasAttribute("aria-current"))).toBe(
			false,
		);
	});

	test("marks a skipped ban in its own slot", async () => {
		await renderBans([null, "middy"]);
		const [skipped] = slots();
		expect(skipped?.dataset.banSlot).toBe("skipped");
		expect(skipped?.textContent).toBe("No ban");
	});
});
