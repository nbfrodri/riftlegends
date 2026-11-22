import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
	SearchSelect,
	type SearchSelectGroup,
} from "../components/search-select";

afterEach(cleanup);

const groups: SearchSelectGroup[] = [
	{
		label: "LCK",
		items: [
			{ value: "geng", label: "Gen.G", detail: "Seed 1" },
			{ value: "t1", label: "T1", detail: "Seed 2" },
		],
	},
	{
		label: "LEC",
		items: [{ value: "g2", label: "G2 Esports", detail: "Seed 3" }],
	},
];

function Picker(props: { onChange?: (value: string) => void }) {
	const [value, setValue] = useState("geng");
	return (
		<SearchSelect
			label="My team"
			searchLabel="Search team"
			empty="No team found"
			groups={groups}
			value={value}
			onChange={(next) => {
				setValue(next);
				props.onChange?.(next);
			}}
		/>
	);
}

test("shows the label of the selected item", () => {
	render(<Picker />);
	expect(
		screen.getByRole("combobox", { name: "My team" }).textContent,
	).toContain("Gen.G");
});

test("lists the items under their group headings", async () => {
	const user = userEvent.setup();
	render(<Picker />);
	await user.click(screen.getByRole("combobox", { name: "My team" }));
	const lck = await screen.findByRole("group", { name: "LCK" });
	expect(
		within(lck)
			.getAllByRole("option")
			.map((o) => o.textContent),
	).toEqual(["Gen.GSeed 1", "T1Seed 2"]);
	expect(
		within(screen.getByRole("group", { name: "LEC" })).getAllByRole("option"),
	).toHaveLength(1);
});

test("filters by typing and selects with the keyboard", async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	render(<Picker onChange={onChange} />);
	await user.click(screen.getByRole("combobox", { name: "My team" }));
	await user.type(
		await screen.findByRole("combobox", { name: "Search team" }),
		"g2",
	);
	expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
		"G2 EsportsSeed 3",
	]);
	expect(screen.queryByRole("group", { name: "LCK" })).toBeNull();
	await user.keyboard("{ArrowDown}{Enter}");
	expect(onChange).toHaveBeenCalledWith("g2");
	expect(
		screen.getByRole("combobox", { name: "My team" }).textContent,
	).toContain("G2 Esports");
});

test("says so when nothing matches", async () => {
	const user = userEvent.setup();
	render(<Picker />);
	await user.click(screen.getByRole("combobox", { name: "My team" }));
	await user.type(
		await screen.findByRole("combobox", { name: "Search team" }),
		"zzz",
	);
	expect(screen.getByText("No team found")).toBeTruthy();
});

test("leaves out the heading of a group without a label", async () => {
	const user = userEvent.setup();
	render(
		<SearchSelect
			label="Club"
			searchLabel="Search"
			empty="None"
			groups={[{ items: [{ value: "a", label: "Alpha" }] }]}
			value="a"
			onChange={() => undefined}
		/>,
	);
	await user.click(screen.getByRole("combobox", { name: "Club" }));
	expect(await screen.findByRole("option", { name: "Alpha" })).toBeTruthy();
	expect(screen.getByRole("group").getAttribute("aria-labelledby")).toBeNull();
});
