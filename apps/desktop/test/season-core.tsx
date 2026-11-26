import { createI18n } from "@rift-legends/i18n";
import { TooltipProvider } from "@rift-legends/ui-kit/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { createCoreHost } from "../src/core-host/host";
import { CoreProvider } from "../src/renderer/core";
import type { CoreApi, CoreCommand, CoreFact } from "../src/shared/bridge";

type Send = CoreApi["send"];

/**
 * The game's real core host behind the renderer's `CoreApi`, as the utility
 * process runs it. `around` can delay or change the answer to a command.
 */
export function hostCore(
	around: (
		command: CoreCommand,
		send: () => ReturnType<Send>,
	) => ReturnType<Send> = (_command, send) => send(),
) {
	const host = createCoreHost();
	const listeners = new Set<(facts: readonly CoreFact[]) => void>();
	let id = 0;
	const receive = (message: object) =>
		host.receive({ id: ++id, ...message }).result as never;
	const api = {
		open: vi.fn(async () => receive({ op: "open" })),
		send: vi.fn((command: CoreCommand) =>
			around(command, async () => {
				const result = receive({ op: "send", body: JSON.stringify(command) });
				return result;
			}).then((result) => {
				if (result.ok) for (const listener of listeners) listener(result.facts);
				return result;
			}),
		),
		query: vi.fn(async (query) =>
			receive({ op: "query", body: JSON.stringify(query) }),
		),
		subscribe: (listener: (facts: readonly CoreFact[]) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	} satisfies CoreApi;
	return api;
}

/** Renders `ui` against `api` with the fictional content (the test seam). */
export async function renderWithCore(
	ui: ReactElement,
	api: CoreApi,
	locale = "en-US",
) {
	window.history.replaceState(null, "", "?content=fictional");
	const i18n = await createI18n(locale);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<TooltipProvider>
					<CoreProvider api={api}>{ui}</CoreProvider>
				</TooltipProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
}
