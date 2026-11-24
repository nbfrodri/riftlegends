import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button, buttonStyle } from "../components/button";

afterEach(cleanup);

test("activates from the keyboard with Enter and Space", async () => {
	const user = userEvent.setup();
	const confirm = vi.fn();
	render(<Button onClick={confirm}>Confirm</Button>);
	await user.tab();
	expect(screen.getByRole("button", { name: "Confirm" })).toBe(
		document.activeElement,
	);
	await user.keyboard("{Enter}");
	await user.keyboard(" ");
	expect(confirm).toHaveBeenCalledTimes(2);
});

test("a disabled button is skipped by Tab and cannot activate", async () => {
	const user = userEvent.setup();
	const confirm = vi.fn();
	render(
		<>
			<Button disabled onClick={confirm}>
				Unavailable
			</Button>
			<Button>Next</Button>
		</>,
	);
	await user.click(screen.getByRole("button", { name: "Unavailable" }));
	await user.tab();
	expect(screen.getByRole("button", { name: "Next" })).toBe(
		document.activeElement,
	);
	expect(confirm).not.toHaveBeenCalled();
});

test("does not submit its form unless asked to", async () => {
	const user = userEvent.setup();
	const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
	render(
		<form
			aria-label="Offer"
			onSubmit={(event) => submit(event.nativeEvent as SubmitEvent)}
		>
			<Button>Preview</Button>
			<Button type="submit">Send offer</Button>
		</form>,
	);
	await user.click(screen.getByRole("button", { name: "Preview" }));
	expect(submit).not.toHaveBeenCalled();
	await user.click(screen.getByRole("button", { name: "Send offer" }));
	expect(submit).toHaveBeenCalledTimes(1);
});

test("an icon-only ghost button is named by its label", () => {
	render(
		<Button variant="ghost" aria-label="Collapse sidebar">
			<svg aria-hidden="true" />
		</Button>,
	);
	expect(
		screen.getByRole("button", { name: "Collapse sidebar" }),
	).toBeDefined();
});

test("#376: every variant shows hover and a press, and a disabled button neither", () => {
	render(
		<>
			<Button>Confirm</Button>
			<Button variant="ghost">Back</Button>
		</>,
	);
	const confirm = screen.getByRole("button", { name: "Confirm" }).className;
	expect(confirm).toMatch(/\bhover:not-data-disabled:bg-text\b/);
	expect(confirm).toMatch(/\bhover:not-data-disabled:border-text\b/);
	const back = screen.getByRole("button", { name: "Back" }).className;
	expect(back).toMatch(/\bhover:not-data-disabled:bg-surface\b/);
	for (const className of [confirm, back]) {
		expect(className).toMatch(/(^|\s)press(\s|$)/);
	}
});

test("a link can look like a button and stay a link", () => {
	render(
		<>
			<Button variant="secondary">Cancel</Button>
			<a href="#settings" className={buttonStyle("secondary")}>
				Back
			</a>
		</>,
	);
	const button = screen.getByRole("button", { name: "Cancel" });
	const link = screen.getByRole("link", { name: "Back" });
	expect(button.className).toContain(link.className);
	expect(link.className).toContain("border-line");
});
