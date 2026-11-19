import { expect, test, vi } from "vitest";
import { registerSystemLocale } from "../src/main/system-locale";
import { systemLocaleChannel } from "../src/shared/bridge";

type Handler = (event: { senderFrame: unknown }) => unknown;

function setup(locale = "es-ES") {
	const mainFrame = { id: "main" };
	let onClosed = () => {};
	const window = {
		webContents: { mainFrame },
		once: (_name: "closed", listener: () => void) => {
			onClosed = listener;
		},
	};
	const handlers = new Map<string, Handler>();
	const ipc = {
		handle: vi.fn((channel: string, handler: Handler) => {
			handlers.set(channel, handler);
		}),
		removeHandler: vi.fn((channel: string) => {
			handlers.delete(channel);
		}),
	};
	registerSystemLocale(window as never, ipc as never, locale);
	const invoke = (senderFrame: unknown = mainFrame) =>
		handlers.get(systemLocaleChannel)?.({ senderFrame });
	return { handlers, invoke, close: () => onClosed() };
}

test("answers the system locale to the main frame", () => {
	expect(setup("es-ES").invoke()).toBe("es-ES");
	expect(setup("en-US").invoke()).toBe("en-US");
});

test.each([
	["a subframe", { id: "iframe" }],
	["a destroyed frame", null],
])("rejects calls from %s", (_name, frame) => {
	expect(() => setup().invoke(frame)).toThrow(/main frame/);
});

test("removes its handler when the window closes", () => {
	const { handlers, close } = setup();
	close();
	expect(handlers.size).toBe(0);
});
