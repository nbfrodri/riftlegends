import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { RangeSlider } from "../components/range-slider";

afterEach(cleanup);

function Controlled(props: { onChange?: (value: [number, number]) => void }) {
	const [value, setValue] = useState<[number, number]>([20, 25]);
	return (
		<RangeSlider
			label="Age"
			minLabel="Minimum age"
			maxLabel="Maximum age"
			min={18}
			max={30}
			value={value}
			onChange={(next) => {
				setValue(next);
				props.onChange?.(next);
			}}
			format={(n) => `${n} y`}
		/>
	);
}

test("has two named thumbs and shows the range as text", () => {
	render(<Controlled />);
	expect(screen.getByRole("group", { name: "Age" })).toBeTruthy();
	const [low, high] = screen.getAllByRole("slider");
	expect(low?.getAttribute("aria-label")).toBe("Minimum age");
	expect(high?.getAttribute("aria-label")).toBe("Maximum age");
	expect(low?.getAttribute("aria-valuetext")).toBe("20 y");
	expect(high?.getAttribute("aria-valuetext")).toBe("25 y");
	expect(screen.getByText("20 y – 25 y")).toBeTruthy();
});

test("moves each thumb with the keyboard", async () => {
	const onChange = vi.fn();
	const user = userEvent.setup();
	render(<Controlled onChange={onChange} />);
	const [low, high] = screen.getAllByRole("slider");
	low?.focus();
	await user.keyboard("{ArrowRight}");
	expect(onChange).toHaveBeenLastCalledWith([21, 25]);
	high?.focus();
	await user.keyboard("{End}");
	expect(onChange).toHaveBeenLastCalledWith([21, 30]);
	expect(screen.getByText("21 y – 30 y")).toBeTruthy();
});
