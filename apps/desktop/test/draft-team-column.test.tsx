import type { DraftView, SeriesOptions } from "@rift-legends/contracts";
import { act, cleanup, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TeamColumn } from "../src/renderer/draft/board/team-column";
import { pacing } from "../src/renderer/draft/broadcast/pacing";
import { renderInLocale } from "./render-in-locale";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

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

let setBans: (bans: (string | null)[]) => void = () => {};
function Harness(props: { bans: (string | null)[] }) {
	const [bans, set] = useState(props.bans);
	setBans = set;
	return (
		<TeamColumn
			side="blue"
			first
			team={{ team: "forge", bans, picks: [] }}
			options={options}
			current={null}
			onPlayer={() => {}}
		/>
	);
}

describe("#436: ban stamp animation", () => {
	const slots = () =>
		within(screen.getByRole("list", { name: "Bans" })).getAllByRole("listitem");
	const stamped = () =>
		slots().map((slot) => slot.querySelector("[data-ban-stamp]"));

	test("only the newly banned slot plays the stamp, timed by the pacing", async () => {
		await renderInLocale(<Harness bans={["toppy"]} />);
		expect(stamped().every((stamp) => stamp === null)).toBe(true);
		act(() => setBans(["toppy", "middy"]));
		const [first, second] = stamped();
		expect(first).toBeNull();
		expect(second).not.toBeNull();
		expect((second as HTMLElement).style.animationDuration).toBe(
			`${pacing.banStampMs}ms`,
		);
		expect(
			within(slots()[1] as HTMLElement).getByRole("img", { name: "Middy" }),
		).toBeTruthy();
	});

	test("bans already on the board render static, also after a remount", async () => {
		await renderInLocale(<Harness bans={["toppy", "middy", null]} />);
		expect(stamped().every((stamp) => stamp === null)).toBe(true);
		act(() => setBans(["toppy", "middy", null]));
		expect(stamped().every((stamp) => stamp === null)).toBe(true);
	});

	test("a skipped ban does not stamp", async () => {
		await renderInLocale(<Harness bans={["toppy"]} />);
		act(() => setBans(["toppy", null]));
		expect(stamped().every((stamp) => stamp === null)).toBe(true);
	});

	test("with reduced motion a new ban appears in its final state", async () => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		vi.spyOn(media, "matches", "get").mockReturnValue(true);
		vi.spyOn(window, "matchMedia").mockReturnValue(media);
		await renderInLocale(<Harness bans={["toppy"]} />);
		act(() => setBans(["toppy", "middy"]));
		expect(stamped().every((stamp) => stamp === null)).toBe(true);
		expect(slots()[1]?.dataset.banSlot).toBe("banned");
	});
});

interface BanTurn {
	bans: (string | null)[];
	banning: boolean;
	preview: string | null;
}
let setTurn: (turn: BanTurn) => void = () => {};
function TurnHarness(props: BanTurn) {
	const [turn, set] = useState(props);
	setTurn = set;
	return (
		<TeamColumn
			side="blue"
			first
			team={{ team: "forge", bans: turn.bans, picks: [] }}
			options={options}
			current={null}
			banning={turn.banning}
			preview={turn.preview}
			onPlayer={() => {}}
		/>
	);
}

describe("#436: the ban preview pulses in the active slot", () => {
	const slots = () =>
		within(screen.getByRole("list", { name: "Bans" })).getAllByRole("listitem");
	const preview = () =>
		(slots()[1] as HTMLElement).querySelector<HTMLElement>(
			"[data-ban-preview]",
		);

	test("the selected champion previews in the active slot, pulsing only the portrait", async () => {
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning preview="middy" />,
		);
		expect(slots().map((slot) => slot.dataset.banSlot)).toEqual([
			"banned",
			"preview",
			"empty",
			"empty",
			"empty",
		]);
		expect(
			within(slots()[1] as HTMLElement).getByRole("img", { name: "Middy" }),
		).toBeTruthy();
		expect(preview()?.className).toContain("draft-pending");
		expect(preview()?.style.animationDuration).toBe(
			`${pacing.pendingPulseMs}ms`,
		);
		// No border or dashed outline around the preview (user, 24-11).
		expect(slots()[1]?.querySelector("[class*='border']")).toBeNull();
	});

	test("the preview shows the ban's diagonal line, which does not pulse", async () => {
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning preview="middy" />,
		);
		const strike = slots()[1]?.querySelector<HTMLElement>("[data-ban-strike]");
		// The same line as a confirmed ban: it reads "this will be banned".
		expect(strike?.className).toContain(
			"after:bg-[linear-gradient(to_bottom_right",
		);
		expect(strike?.getAttribute("aria-hidden")).toBe("true");
		// Outside the pulsing portrait, which stays in colour.
		expect(preview()?.contains(strike as Node)).toBe(false);
		const face = within(slots()[1] as HTMLElement).getByRole("img", {
			name: "Middy",
		});
		expect(face.querySelector("img.grayscale")).toBeNull();
		expect(face.className).not.toContain("after:bg-[linear-gradient");
	});

	test("deselecting clears the preview", async () => {
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning preview="middy" />,
		);
		act(() => setTurn({ bans: ["toppy"], banning: true, preview: null }));
		expect(slots()[1]?.dataset.banSlot).toBe("empty");
		expect(preview()).toBeNull();
	});

	test("without a ban turn there is no preview", async () => {
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning={false} preview="middy" />,
		);
		expect(slots().some((slot) => slot.dataset.banSlot === "preview")).toBe(
			false,
		);
	});

	test("with reduced motion the preview is dimmed and does not pulse", async () => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		vi.spyOn(media, "matches", "get").mockReturnValue(true);
		vi.spyOn(window, "matchMedia").mockReturnValue(media);
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning preview="middy" />,
		);
		expect(preview()?.className).not.toContain("draft-pending");
		expect(preview()?.className).toContain("opacity-50");
		// The portrait is dimmed; the line stays at full strength.
		const strike = slots()[1]?.querySelector("[data-ban-strike]");
		expect(strike).not.toBeNull();
		expect(preview()?.contains(strike as Node)).toBe(false);
	});

	test("confirming the previewed ban plays the stamp in that slot", async () => {
		await renderInLocale(
			<TurnHarness bans={["toppy"]} banning preview="middy" />,
		);
		act(() =>
			setTurn({ bans: ["toppy", "middy"], banning: false, preview: null }),
		);
		expect(slots()[1]?.dataset.banSlot).toBe("banned");
		expect(slots()[1]?.querySelector("[data-ban-stamp]")).not.toBeNull();
		expect(preview()).toBeNull();
	});
});

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

	test("#494: the art covers the right 3/5 of the row and fades into the player", async () => {
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
		const box = portrait("Toppy") as HTMLElement;
		// The original blend (user, 25-11): the tile fills the box, which
		// fades in over its left half; focal framings size against the box.
		expect(box.className).toContain("w-3/5");
		expect(box.className).toContain("[container-type:size]");
		expect(box.className).toContain(
			"[mask-image:linear-gradient(to_right,transparent,#000_55%)]",
		);
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
