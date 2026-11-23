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

test("a disabled option cannot be chosen", async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	render(
		<SegmentedControl
			label="Format"
			options={[
				...options.slice(0, 2),
				{ value: "bo5", label: "Bo5", disabled: true },
			]}
			value="bo3"
			onChange={onChange}
		/>,
	);
	const bo5 = screen.getByRole("radio", { name: "Bo5" }) as HTMLInputElement;
	expect(bo5.disabled).toBe(true);
	await user.click(bo5);
	expect(onChange).not.toHaveBeenCalled();
});

test("#376: the checked option is filled in the action colour, with no line under it", () => {
	render(
		<SegmentedControl
			label="Format"
			options={options}
			value="bo3"
			onChange={() => {}}
		/>,
	);
	const face = (name: string) =>
		screen.getByRole("radio", { name }).nextElementSibling?.className ?? "";
	expect(face("Bo3")).toMatch(/\bpeer-checked:bg-action\b/);
	expect(face("Bo3")).toMatch(/\bpeer-checked:text-on-action\b/);
	expect(face("Bo3")).toMatch(/\bpeer-checked:border-action\b/);
	expect(face("Bo3")).not.toMatch(/shadow-\[inset_0_-|underline|border-b/);
});

test("#376: enabled options show a press; a disabled one does not", () => {
	render(
		<SegmentedControl
			label="Format"
			options={[
				...options.slice(0, 2),
				{ value: "bo5", label: "Bo5", disabled: true },
			]}
			value="bo3"
			onChange={() => {}}
		/>,
	);
	const label = (name: string) =>
		screen.getByRole("radio", { name }).closest("label")?.className ?? "";
	expect(label("Bo1")).toMatch(/(^|\s)press(\s|$)/);
	expect(label("Bo5")).not.toMatch(/(^|\s)press(\s|$)/);
});
