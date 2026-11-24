import type { DraftView, SeriesOptions } from "@rift-legends/contracts";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
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

describe("#435: the pick preview pulses until it is locked in", () => {
	const team = (picks: string[]): DraftView["blue"] => ({
		team: "forge",
		bans: [],
		picks,
	});
	const row = () =>
		within(screen.getByRole("region")).getAllByRole("button")[0] as HTMLElement;
	const portrait = (name: string) =>
		within(row()).getByRole("img", { name }).closest("[data-preview]");
	const mark = () => row().querySelector("[data-pending-mark]");

	afterEach(() => vi.restoreAllMocks());

	test("the unconfirmed preview is pending and pulses", async () => {
		await renderInLocale(
			<TeamColumn
				side="blue"
				first
				team={team([])}
				options={options}
				current={0}
				preview="toppy"
				onPlayer={() => {}}
			/>,
		);
		expect(row().dataset.pending).toBe("true");
		expect(portrait("Toppy")?.className).toContain("draft-pending");
		// Only the portrait pulses: no border around the row (user, 24-11).
		expect(mark()).toBeNull();
		expect(row().textContent).toContain("Choosing");
	});

	test("a locked pick stops pulsing", async () => {
		await renderInLocale(
			<TeamColumn
				side="blue"
				first
				team={team(["toppy"])}
				options={options}
				current={null}
				onPlayer={() => {}}
			/>,
		);
		expect(row().dataset.pending).toBeUndefined();
		expect(portrait("Toppy")?.className).not.toContain("draft-pending");
		expect(mark()).toBeNull();
	});

	test("with reduced motion it does not pulse and says it is still choosing", async () => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		vi.spyOn(media, "matches", "get").mockReturnValue(true);
		vi.spyOn(window, "matchMedia").mockReturnValue(media);
		await renderInLocale(
			<TeamColumn
				side="blue"
				first
				team={team([])}
				options={options}
				current={0}
				preview="toppy"
				onPlayer={() => {}}
			/>,
		);
		expect(row().dataset.pending).toBe("true");
		expect(portrait("Toppy")?.className).not.toContain("draft-pending");
		expect(mark()).toBeNull();
		expect(row().textContent).toContain("Choosing");
	});
});
