import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/select";

afterEach(cleanup);

const languages = [
	{ value: "es", label: "Español" },
	{ value: "fr", label: "Français" },
	{ value: "en", label: "English" },
];

function LanguageSelect({
	onValueChange,
}: {
	onValueChange?: (value: string | null) => void;
}) {
	return (
		<Select
			items={languages}
			defaultValue="es"
			{...(onValueChange ? { onValueChange } : {})}
		>
			<SelectTrigger aria-label="Language">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{languages.map(({ value, label }) => (
					<SelectItem key={value} value={value} disabled={value === "fr"}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

test("shows the label of the current value, not the raw value", () => {
	render(<LanguageSelect />);
	expect(
		screen.getByRole("combobox", { name: "Language" }).textContent,
	).toContain("Español");
});

test("opens from the keyboard and lists every option", async () => {
	const user = userEvent.setup();
	render(<LanguageSelect />);
	await user.tab();
	await user.keyboard("{Enter}");
	const listbox = await screen.findByRole("listbox");
	expect(
		Array.from(listbox.querySelectorAll('[role="option"]'), (option) =>
			option.textContent?.trim(),
		),
	).toEqual(["Español", "Français", "English"]);
	expect(
		screen
			.getByRole("option", { name: "Español" })
			.getAttribute("aria-selected"),
	).toBe("true");
});

test("a disabled option stays discoverable but cannot be chosen", async () => {
	const user = userEvent.setup();
	const onValueChange = vi.fn();
	render(<LanguageSelect onValueChange={onValueChange} />);
	await user.tab();
	await user.keyboard("{Enter}");
	await screen.findByRole("listbox");
	await user.keyboard("{ArrowDown}");
	expect(document.activeElement).toBe(
		screen.getByRole("option", { name: "Français" }),
	);
	await user.keyboard("{Enter}");
	expect(screen.getByRole("listbox")).toBeDefined();
	expect(onValueChange).not.toHaveBeenCalled();
});

test("commits a keyboard choice and returns focus to the trigger", async () => {
	const user = userEvent.setup();
	const onValueChange = vi.fn();
	render(<LanguageSelect onValueChange={onValueChange} />);
	const trigger = screen.getByRole("combobox", { name: "Language" });
	await user.tab();
	await user.keyboard("{Enter}");
	await screen.findByRole("listbox");
	await user.keyboard("{End}{Enter}");
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
	expect(onValueChange).toHaveBeenCalledTimes(1);
	expect(onValueChange.mock.calls[0]?.[0]).toBe("en");
	expect(trigger.textContent).toContain("English");
	expect(trigger).toBe(document.activeElement);
});

test("Escape closes without changing the value", async () => {
	const user = userEvent.setup();
	const onValueChange = vi.fn();
	render(<LanguageSelect onValueChange={onValueChange} />);
	await user.tab();
	await user.keyboard("{Enter}");
	await screen.findByRole("listbox");
	await user.keyboard("{ArrowDown}{Escape}");
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
	expect(onValueChange).not.toHaveBeenCalled();
	expect(
		screen.getByRole("combobox", { name: "Language" }).textContent,
	).toContain("Español");
});

test("an open select adds no inline <style>, which the renderer CSP blocks", async () => {
	const user = userEvent.setup();
	render(<LanguageSelect />);
	await user.tab();
	await user.keyboard("{Enter}");
	await screen.findByRole("listbox");
	expect(document.querySelectorAll("style")).toHaveLength(0);
});
