import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SegmentedControl } from "../components/segmented-control";

afterEach(cleanup);

const options = [
	{ value: "bo1", label: "Bo1" },
	{ value: "bo3", label: "Bo3" },
	{ value: "bo5", label: "Bo5" },
];

test("is a radio group named by its label, with the current value checked", () => {
	render(
		<SegmentedControl
			label="Format"
			options={options}
			value="bo3"
			onChange={() => {}}
		/>,
	);
	expect(screen.getByRole("radiogroup", { name: "Format" })).toBeTruthy();
	expect(
		(screen.getByRole("radio", { name: "Bo3" }) as HTMLInputElement).checked,
	).toBe(true);
	expect(
		(screen.getByRole("radio", { name: "Bo1" }) as HTMLInputElement).checked,
	).toBe(false);
});

test("changes the value by click and with the arrow keys", async () => {
	const onChange = vi.fn();
	const user = userEvent.setup();
	render(
		<SegmentedControl
			label="Format"
			options={options}
			value="bo3"
			onChange={onChange}
		/>,
	);
	await user.click(screen.getByRole("radio", { name: "Bo5" }));
	expect(onChange).toHaveBeenLastCalledWith("bo5");
	await user.click(screen.getByRole("radio", { name: "Bo3" }));
	await user.keyboard("{ArrowLeft}");
	expect(onChange).toHaveBeenLastCalledWith("bo1");
});
