import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Kbd } from "../components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../components/tooltip";

afterEach(cleanup);

// Base UI tooltips are visual only: the trigger carries its own accessible name.
function RailToggle() {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger aria-label="Collapse sidebar" aria-keyshortcuts="Alt+B">
					<svg aria-hidden="true" />
				</TooltipTrigger>
				<TooltipContent>
					Collapse sidebar <Kbd>Alt+B</Kbd>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

test("keyboard focus reveals the tooltip with its shortcut as keyboard input", async () => {
	const user = userEvent.setup();
	render(<RailToggle />);
	expect(screen.queryByText("Alt+B")).toBeNull();
	await user.tab();
	expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBe(
		document.activeElement,
	);
	const shortcut = await screen.findByText("Alt+B");
	expect(shortcut.tagName).toBe("KBD");
	expect(shortcut.parentElement?.textContent).toBe("Collapse sidebar Alt+B");
});

test("Escape dismisses the tooltip and keeps focus on the trigger", async () => {
	const user = userEvent.setup();
	render(<RailToggle />);
	await user.tab();
	await screen.findByText("Alt+B");
	await user.keyboard("{Escape}");
	await waitFor(() => expect(screen.queryByText("Alt+B")).toBeNull());
	expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBe(
		document.activeElement,
	);
});

test("moving focus away hides the tooltip", async () => {
	const user = userEvent.setup();
	render(
		<>
			<RailToggle />
			<button type="button">Draft</button>
		</>,
	);
	await user.tab();
	await screen.findByText("Alt+B");
	await user.tab();
	await waitFor(() => expect(screen.queryByText("Alt+B")).toBeNull());
});
