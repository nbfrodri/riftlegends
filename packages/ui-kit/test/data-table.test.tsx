import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { setViewportHeight } from "./layout";

afterEach(cleanup);

// T10 runs over 36 rows of made-up data.
type Player = { id: string; name: string; team: string; age: number };

const names = [
	"Nadir",
	"Vega",
	"Lumen",
	"Ónix",
	"Brisa",
	"Cobalto",
	"Dune",
	"Ecos",
	"Fénix",
	"Gala",
	"Helio",
	"Iris",
];
const teams = ["Bruma", "Ascua", "Duna"];
const players: Player[] = Array.from({ length: 36 }, (_, index) => ({
	id: `p${index}`,
	name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
	team: teams[index % teams.length] ?? "",
	// A shuffled but deterministic spread of ages: 17 to 28, all repeated.
	age: 17 + ((index * 7) % 12),
}));

const columns: DataTableColumn<Player>[] = [
	{ id: "name", header: "Player", value: (row) => row.name },
	{ id: "team", header: "Team", value: (row) => row.team },
	{
		id: "age",
		header: "Age",
		value: (row) => row.age,
		cell: (row) => `${row.age} yrs`,
		numeric: true,
	},
];

function Table({ data = players }: { data?: Player[] }) {
	return (
		<DataTable
			label="Players"
			data={data}
			columns={columns}
			getRowId={(row) => row.id}
			filterLabel="Filter players"
			filterPlaceholder="Player or team"
			emptyText="No player matches the filter"
			countLabel={(shown, total) => `${shown} of ${total} players`}
		/>
	);
}

const body = () => screen.getAllByRole("rowgroup")[1] as HTMLElement;
const rows = () => within(body()).getAllByRole("row");
const header = (name: string) => screen.getByRole("columnheader", { name });
const headersWithSort = () =>
	screen
		.getAllByRole("columnheader")
		.filter((column) => column.hasAttribute("aria-sort"));
const sortButton = (name: string) =>
	within(header(name)).getByRole("button", { name });
const ageColumn = () =>
	rows().map((row) =>
		Number.parseInt(within(row).getAllByRole("cell")[2]?.textContent ?? "", 10),
	);

test("shows every row under a sticky header in its own scrolling region", () => {
	render(<Table />);
	expect(screen.getByRole("table", { name: "Players" })).toBeTruthy();
	expect(rows()).toHaveLength(36);
	expect(screen.getByRole("region", { name: "Players" })).toBeTruthy();
	expect(header("Age").classList.contains("sticky")).toBe(true);
});

test("sorts by a column on click: ascending, descending, then back to none", async () => {
	const user = userEvent.setup();
	render(<Table />);
	const original = ageColumn();
	expect(headersWithSort()).toEqual([]);

	await user.click(sortButton("Age"));
	expect(header("Age").getAttribute("aria-sort")).toBe("ascending");
	expect(ageColumn()).toEqual([...original].sort((a, b) => a - b));

	await user.click(sortButton("Age"));
	expect(header("Age").getAttribute("aria-sort")).toBe("descending");
	expect(ageColumn()).toEqual([...original].sort((a, b) => b - a));

	await user.click(sortButton("Age"));
	expect(headersWithSort()).toEqual([]);
	expect(ageColumn()).toEqual(original);
});

test("sorts text columns and moves aria-sort to the last sorted header", async () => {
	const user = userEvent.setup();
	render(<Table />);
	await user.click(sortButton("Team"));
	expect(header("Team").getAttribute("aria-sort")).toBe("ascending");
	expect(headersWithSort()).toEqual([header("Team")]);
	const teamsShown = rows().map(
		(row) => within(row).getAllByRole("cell")[1]?.textContent,
	);
	expect(teamsShown).toEqual([...teamsShown].sort());

	await user.click(sortButton("Player"));
	expect(header("Player").getAttribute("aria-sort")).toBe("ascending");
	expect(headersWithSort()).toEqual([header("Player")]);
});

test("sorts from the keyboard with Enter and Space on the header button", async () => {
	const user = userEvent.setup();
	render(<Table />);
	await user.tab();
	await user.tab();
	await user.tab();
	await user.tab();
	// 0: filter, then the three header buttons.
	expect(document.activeElement).toBe(sortButton("Age"));

	await user.keyboard("{Enter}");
	expect(header("Age").getAttribute("aria-sort")).toBe("ascending");
	await user.keyboard(" ");
	expect(header("Age").getAttribute("aria-sort")).toBe("descending");
});

test("filters rows by text across columns, ignoring case and accents", async () => {
	const user = userEvent.setup();
	render(<Table />);
	const filter = screen.getByRole("searchbox", { name: "Filter players" });
	expect(filter.getAttribute("placeholder")).toBe("Player or team");
	expect(screen.getByRole("status").textContent).toBe("36 of 36 players");

	await user.type(filter, "onix");
	expect(rows()).toHaveLength(3);
	for (const row of rows()) expect(row.textContent).toMatch(/Ónix/);
	expect(screen.getByRole("status").textContent).toBe("3 of 36 players");

	await user.clear(filter);
	await user.type(filter, "ASCUA");
	expect(rows()).toHaveLength(12);
	for (const row of rows()) expect(row.textContent).toMatch(/Ascua/);
});

test("shows an empty state when nothing matches", async () => {
	const user = userEvent.setup();
	render(<Table />);
	await user.type(
		screen.getByRole("searchbox", { name: "Filter players" }),
		"zzz",
	);
	expect(screen.getByText("No player matches the filter")).toBeTruthy();
	expect(screen.queryByRole("row", { name: /Nadir/ })).toBeNull();
	expect(screen.getByRole("status").textContent).toBe("0 of 36 players");
});

test("shows the empty state for a table without rows", () => {
	render(<Table data={[]} />);
	expect(screen.getByText("No player matches the filter")).toBeTruthy();
});

test("moves between rows with the arrow keys, Home and End", async () => {
	const user = userEvent.setup();
	render(<Table />);
	const all = rows();
	const first = all[0] as HTMLElement;
	const last = all[35] as HTMLElement;

	// Roving tabindex: one tab stop in the body, the first row until a move.
	expect(all.filter((row) => row.tabIndex === 0)).toEqual([first]);
	first.focus();
	await user.keyboard("{ArrowDown}");
	expect(document.activeElement).toBe(all[1]);
	expect(all.filter((row) => row.tabIndex === 0)).toEqual([all[1]]);
	await user.keyboard("{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}");
	expect(document.activeElement).toBe(first);
	await user.keyboard("{End}");
	expect(document.activeElement).toBe(last);
	await user.keyboard("{ArrowDown}");
	expect(document.activeElement).toBe(last);
	await user.keyboard("{Home}");
	expect(document.activeElement).toBe(first);
});

test("marks the focused row so its focus stays visible", async () => {
	const user = userEvent.setup();
	render(<Table />);
	const second = rows()[1] as HTMLElement;
	await user.click(second);
	expect(document.activeElement).toBe(second);
	expect(second.classList.contains("focus-visible:outline-3")).toBe(true);
});

test("keeps row navigation inside the filtered rows", async () => {
	const user = userEvent.setup();
	render(<Table />);
	await user.type(
		screen.getByRole("searchbox", { name: "Filter players" }),
		"Brisa",
	);
	const shown = rows();
	expect(shown).toHaveLength(3);
	(shown[0] as HTMLElement).focus();
	await user.keyboard("{End}");
	expect(document.activeElement).toBe(shown[2]);
});

test("right-aligns numeric columns with tabular figures, left-aligns the rest", () => {
	render(<Table />);
	const [firstRow] = rows();
	const cells = within(firstRow as HTMLElement).getAllByRole("cell");
	const [name, , age] = cells as HTMLElement[];
	for (const element of [age, header("Age")] as HTMLElement[]) {
		expect(element.classList.contains("text-right")).toBe(true);
		expect(element.classList.contains("tabular-nums")).toBe(true);
	}
	expect(name?.classList.contains("text-right")).toBe(false);
	expect(header("Player").classList.contains("text-right")).toBe(false);
});

// Virtualised window: a 240px region shows 10 rows plus 8 of overscan, so the
// 36-row table mounts fewer rows than it has.
describe("with a short scrolling region", () => {
	beforeEach(() => setViewportHeight(240));

	const table = () => screen.getByRole("table", { name: "Players" });
	const region = () => screen.getByRole("region", { name: "Players" });
	const rowIndexes = () =>
		rows().map((row) => Number(row.getAttribute("aria-rowindex")));
	const scrollTo = (top: number) => {
		region().scrollTop = top;
		fireEvent.scroll(region());
	};

	test("mounts only a window of rows and reports the full count", () => {
		render(<Table />);
		expect(rows().length).toBeLessThan(36);
		// 36 rows plus the header row.
		expect(table().getAttribute("aria-rowcount")).toBe("37");
		expect(rowIndexes()[0]).toBe(2);
		expect(rowIndexes()).toEqual(
			rowIndexes().map((_, offset) => (rowIndexes()[0] ?? 0) + offset),
		);
	});

	test("keeps the scroll height of the whole table with hidden spacer rows", () => {
		render(<Table />);
		scrollTo(480);
		const spacers = [...body().querySelectorAll("tr[aria-hidden=true]")];
		expect(spacers.length).toBeGreaterThan(0);
		const spacerHeight = spacers.reduce(
			(sum, row) => sum + Number.parseFloat((row as HTMLElement).style.height),
			0,
		);
		expect(spacerHeight + rows().length * 24).toBe(36 * 24);
	});

	test("Home and End focus rows that are not mounted yet", async () => {
		const user = userEvent.setup();
		render(<Table />);
		(rows()[0] as HTMLElement).focus();
		await user.keyboard("{End}");
		expect(document.activeElement?.getAttribute("aria-rowindex")).toBe("37");
		expect(document.activeElement?.textContent).toMatch(/Iris 3/);
		await user.keyboard("{Home}");
		expect(document.activeElement?.getAttribute("aria-rowindex")).toBe("2");
		expect(document.activeElement?.textContent).toMatch(/Nadir 1/);
	});

	test("the arrow keys walk past the mounted window", async () => {
		const user = userEvent.setup();
		render(<Table />);
		(rows()[0] as HTMLElement).focus();
		const mounted = rows().length;
		await user.keyboard("{ArrowDown}".repeat(mounted + 3));
		expect(document.activeElement?.getAttribute("aria-rowindex")).toBe(
			String(mounted + 5),
		);
		await user.keyboard("{ArrowUp}".repeat(mounted + 3));
		expect(document.activeElement?.getAttribute("aria-rowindex")).toBe("2");
	});

	test("keeps the active row mounted and as the only tab stop after scrolling away", async () => {
		const user = userEvent.setup();
		render(<Table />);
		(rows()[3] as HTMLElement).focus();
		const active = document.activeElement as HTMLElement;
		scrollTo(36 * 24);
		expect(rowIndexes()).not.toContain(2);
		expect(body().contains(active)).toBe(true);
		expect(rows().filter((row) => row.tabIndex === 0)).toEqual([active]);
		// Tab from the last header button enters the table at the active row.
		sortButton("Age").focus();
		await user.tab();
		expect(document.activeElement).toBe(active);
	});

	// #399: two-tone rows instead of a rule every five; the tone follows the
	// row index, so it stays put while the virtual window scrolls.
	test("alternates the row tone by index, not by position", () => {
		render(<Table />);
		scrollTo(7 * 24);
		for (const row of rows()) {
			const index = Number(row.getAttribute("aria-rowindex")) - 2;
			expect(row.getAttribute("data-odd")).toBe(String(index % 2 === 1));
			expect(row.className.includes("bg-canvas/50")).toBe(index % 2 === 1);
			expect(row.hasAttribute("data-fifth")).toBe(false);
		}
	});
});
