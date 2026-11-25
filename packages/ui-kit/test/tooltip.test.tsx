import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Tooltip, TooltipProvider } from "../components/tooltip";

const { animate } = vi.hoisted(() => ({
	animate: vi.fn((..._args: unknown[]) => ({ complete: () => {} })),
}));
vi.mock("motion/mini", () => ({ animate }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	animate.mockClear();
});

function RailToggle() {
	return (
		<TooltipProvider delay={0}>
			<Tooltip heading="Sidebar" content="Collapse sidebar" shortcut="Alt+B">
				<button
					type="button"
					aria-label="Collapse sidebar"
					aria-keyshortcuts="Alt+B"
				>
					<svg aria-hidden="true" />
				</button>
			</Tooltip>
			<Tooltip content="Open draft">
				<button type="button" aria-label="Draft" />
			</Tooltip>
		</TooltipProvider>
	);
}

test("hover opens the Caja tooltip and moving to another trigger replaces its contents", async () => {
	const user = userEvent.setup();
	render(<RailToggle />);
	expect(screen.queryByRole("tooltip")).toBeNull();
	await user.hover(screen.getByRole("button", { name: "Collapse sidebar" }));
	const popup = within(await screen.findByRole("tooltip"));
	expect(popup.getByText("Sidebar").tagName).toBe("STRONG");
	expect(popup.getByText("Collapse sidebar")).toBeTruthy();
	expect(popup.getByText("Alt+B").tagName).toBe("KBD");
	await user.hover(screen.getByRole("button", { name: "Draft" }));
	await screen.findByText("Open draft");
	expect(screen.getAllByRole("tooltip")).toHaveLength(1);
	expect(screen.queryByText("Alt+B")).toBeNull();
});

test("keyboard focus opens the tooltip and Escape dismisses it without moving focus", async () => {
	const user = userEvent.setup();
	render(<RailToggle />);
	await user.tab();
	await screen.findByRole("tooltip");
	await user.keyboard("{Escape}");
	await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
	expect(document.activeElement).toBe(
		screen.getByRole("button", { name: "Collapse sidebar" }),
	);
});

test("moving focus away hides the tooltip", async () => {
	const user = userEvent.setup();
	render(
		<>
			<RailToggle />
			<button type="button">Continue</button>
		</>,
	);
	await user.tab();
	await user.tab();
	await screen.findByText("Open draft");
	await user.tab();
	await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

test("the popup fades in quickly when motion is allowed", async () => {
	const user = userEvent.setup();
	render(<RailToggle />);
	await user.tab();
	const popup = await screen.findByRole("tooltip");
	await waitFor(() => expect(animate).toHaveBeenCalledOnce());
	const [target, keyframes, options] = animate.mock.calls[0] ?? [];
	expect(target).toEqual([popup]);
	expect(keyframes).toMatchObject({ opacity: [0, 1] });
	expect(options).toMatchObject({ duration: 0.12 });
});

test("reduced motion shows the popup without an entrance animation", async () => {
	const media = window.matchMedia("(prefers-reduced-motion: reduce)");
	vi.spyOn(media, "matches", "get").mockReturnValue(true);
	vi.spyOn(window, "matchMedia").mockReturnValue(media);
	const user = userEvent.setup();
	render(<RailToggle />);
	await user.tab();
	await screen.findByRole("tooltip");
	expect(animate).not.toHaveBeenCalled();
});

test("a click does not open the tooltip and leaving the trigger closes it", async () => {
	const user = userEvent.setup();
	render(
		<>
			<RailToggle />
			<p>Elsewhere</p>
		</>,
	);
	await user.click(screen.getByRole("button", { name: "Draft" }));
	expect(screen.queryByRole("tooltip")).toBeNull();
	await user.hover(screen.getByRole("button", { name: "Collapse sidebar" }));
	await screen.findByRole("tooltip");
	await user.hover(screen.getByText("Elsewhere"));
	await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

test("hover waits for the provider delay; a disabled tooltip never opens", async () => {
	const user = userEvent.setup();
	render(
		<TooltipProvider delay={300}>
			<Tooltip content="Later">
				<button type="button">Slow</button>
			</Tooltip>
			<Tooltip content="Never" disabled>
				<button type="button">Off</button>
			</Tooltip>
		</TooltipProvider>,
	);
	await user.hover(screen.getByRole("button", { name: "Slow" }));
	expect(screen.queryByRole("tooltip")).toBeNull();
	expect((await screen.findByRole("tooltip")).textContent).toBe("Later");
	await user.hover(screen.getByRole("button", { name: "Off" }));
	await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
	expect(screen.getByRole("button", { name: "Off" }).dataset.tooltip).toBe(
		undefined,
	);
});

test("an extra line shows rich content, such as an icon and a value, under the text", async () => {
	const user = userEvent.setup();
	render(
		<TooltipProvider delay={0}>
			<Tooltip
				heading="Keria"
				content="Rakan"
				extra={
					<span data-testid="extra">
						<img alt="" src="rift-asset://cdragon/stats/vision.svg" />
						Vision 42
					</span>
				}
			>
				<span>Keria</span>
			</Tooltip>
		</TooltipProvider>,
	);
	await user.hover(screen.getByText("Keria"));
	const popup = within(await screen.findByRole("tooltip"));
	expect(popup.getByText("Rakan")).toBeTruthy();
	const extra = popup.getByTestId("extra");
	expect(extra.textContent).toBe("Vision 42");
	expect(extra.querySelector("img")?.getAttribute("src")).toBe(
		"rift-asset://cdragon/stats/vision.svg",
	);
});
