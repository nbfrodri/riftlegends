import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Info } from "lucide-react";
import { afterEach, expect, test, vi } from "vitest";
import { IconButton } from "../components/icon-button";

afterEach(cleanup);

test("is a button named by its label, with the icon hidden from assistive tech", () => {
	render(<IconButton label="Show details" icon={Info} onClick={() => {}} />);
	const button = screen.getByRole("button", { name: "Show details" });
	expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("activates with the keyboard and shows its label as a tooltip on focus", async () => {
	const onClick = vi.fn();
	const user = userEvent.setup();
	render(<IconButton label="Show details" icon={Info} onClick={onClick} />);
	await user.tab();
	expect(document.activeElement).toBe(
		screen.getByRole("button", { name: "Show details" }),
	);
	await waitFor(() =>
		expect(
			document.querySelector("[data-slot=tooltip-content]")?.textContent,
		).toBe("Show details"),
	);
	await user.keyboard("{Enter}");
	expect(onClick).toHaveBeenCalledTimes(1);
});

test("does not fire when disabled", async () => {
	const onClick = vi.fn();
	const user = userEvent.setup();
	render(
		<IconButton label="Show details" icon={Info} disabled onClick={onClick} />,
	);
	await user.click(screen.getByRole("button", { name: "Show details" }));
	expect(onClick).not.toHaveBeenCalled();
});
