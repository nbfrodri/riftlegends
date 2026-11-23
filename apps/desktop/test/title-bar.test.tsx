import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TitleBar } from "../src/renderer/title-bar";
import type { WindowControls } from "../src/shared/bridge";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

function fakeControls(maximized = false, canMinimize = true) {
	let notify: (maximized: boolean) => void = () => {};
	const unsubscribe = vi.fn();
	const controls = {
		minimize: vi.fn(),
		toggleMaximize: vi.fn(),
		close: vi.fn(),
		isMaximized: vi.fn().mockResolvedValue(maximized),
		canMinimize: vi.fn().mockResolvedValue(canMinimize),
		onMaximizedChange: vi.fn((listener: (maximized: boolean) => void) => {
			notify = listener;
			return unsubscribe;
		}),
	} satisfies WindowControls;
	return { controls, unsubscribe, emit: (state: boolean) => notify(state) };
}

test("shows the game icon to the left of the title, decorative and bundled", async () => {
	await renderInLocale(<TitleBar controls={fakeControls().controls} />);
	const title = screen.getByText("Rift Legends");
	const icon = title.parentElement?.querySelector("img");
	expect(icon?.getAttribute("alt")).toBe("");
	expect(icon?.getAttribute("src")).toBe("./icon-small.svg");
	expect(icon?.getAttribute("height")).toBe("16");
	expect(icon).toBeTruthy();
	expect(
		// biome-ignore lint/style/noNonNullAssertion: asserted just above
		icon!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
});

test("routes minimize and close to the window controls", async () => {
	const { controls } = fakeControls();
	await renderInLocale(<TitleBar controls={controls} />);
	fireEvent.click(await screen.findByRole("button", { name: "Minimize" }));
	fireEvent.click(screen.getByRole("button", { name: "Close" }));
	expect(controls.minimize).toHaveBeenCalledOnce();
	expect(controls.close).toHaveBeenCalledOnce();
});

test("labels the toggle button after the initial native state", async () => {
	await renderInLocale(<TitleBar controls={fakeControls(true).controls} />);
	fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
	expect(screen.queryByRole("button", { name: "Maximize" })).toBeNull();
});

test("follows maximize changes and unsubscribes on unmount", async () => {
	const { controls, unsubscribe, emit } = fakeControls();
	const view = await renderInLocale(<TitleBar controls={controls} />);
	fireEvent.click(await screen.findByRole("button", { name: "Maximize" }));
	expect(controls.toggleMaximize).toHaveBeenCalledOnce();
	act(() => emit(true));
	expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
	act(() => emit(false));
	expect(screen.getByRole("button", { name: "Maximize" })).toBeTruthy();
	view.unmount();
	expect(unsubscribe).toHaveBeenCalledOnce();
});

test("a change event wins over a slower initial query", async () => {
	const { controls, emit } = fakeControls(false);
	let resolveInitial: (maximized: boolean) => void = () => {};
	controls.isMaximized.mockReturnValue(
		new Promise<boolean>((resolve) => {
			resolveInitial = resolve;
		}),
	);
	await renderInLocale(<TitleBar controls={controls} />);
	act(() => emit(true));
	await act(async () => resolveInitial(false));
	expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
});

test("hides minimize where the window manager cannot minimize", async () => {
	const { controls } = fakeControls(false, false);
	await renderInLocale(<TitleBar controls={controls} />);
	await screen.findByRole("button", { name: "Maximize" });
	await act(async () => {});
	expect(screen.queryByRole("button", { name: "Minimize" })).toBeNull();
	expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
});

test("labels the window controls in the system language", async () => {
	await renderInLocale(
		<TitleBar controls={fakeControls(true).controls} />,
		"es-ES",
	);
	expect(screen.getByText("Rift Legends")).toBeTruthy();
	expect(await screen.findByRole("button", { name: "Minimizar" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("labels maximize in Spanish while the window is restored", async () => {
	await renderInLocale(<TitleBar controls={fakeControls().controls} />, "es");
	expect(await screen.findByRole("button", { name: "Maximizar" })).toBeTruthy();
});

test("the window controls show their name in the Caja tooltip", async () => {
	const user = userEvent.setup();
	await renderInLocale(<TitleBar controls={fakeControls().controls} />);
	const close = await screen.findByRole("button", { name: "Close" });
	expect(close.hasAttribute("title")).toBe(false);
	await user.hover(close);
	expect((await screen.findByRole("tooltip")).textContent).toBe("Close");
});
