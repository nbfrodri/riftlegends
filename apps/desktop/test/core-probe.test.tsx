import { createI18n } from "@rift-legends/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, test } from "vitest";
import { CoreProvider } from "../src/renderer/core";
import { CoreProbe } from "../src/renderer/core/probe";
import type { CoreApi, CoreFact } from "../src/shared/bridge";

afterEach(cleanup);

/** A core with the debug catalog whose sessions vanish on `restart`. */
function fakeCore() {
	const listeners = new Set<(facts: readonly CoreFact[]) => void>();
	const sessions = new Map<number, number>();
	let nextId = 1;
	const unknown = (sessionId: number) => ({
		ok: false as const,
		error: { code: "unknown-session" as const, params: { sessionId } },
	});
	const api: CoreApi = {
		open: async () => {
			const sessionId = nextId++;
			sessions.set(sessionId, 0);
			return { ok: true, sessionId };
		},
		send: async ({ sessionId }) => {
			const count = sessions.get(sessionId);
			if (count === undefined) return unknown(sessionId);
			sessions.set(sessionId, count + 1);
			const facts = [
				{ type: "debug.ticked", position: count, count: count + 1 },
			];
			for (const listener of [...listeners]) listener(facts);
			return { ok: true, position: count + 1, facts };
		},
		query: async ({ sessionId }) => {
			const count = sessions.get(sessionId);
			return count === undefined
				? unknown(sessionId)
				: { ok: true, view: { count } };
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
	// Like the real core, a restarted one numbers its sessions from 1 again.
	const restart = () => {
		sessions.clear();
		nextId = 1;
	};
	return { api, restart };
}

async function renderProbe(api: CoreApi) {
	const i18n = await createI18n("en-US");
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<CoreProvider api={api}>
					<CoreProbe />
				</CoreProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
}

const count = () => screen.getByRole("status").textContent;

test("opens a session and shows each tick's fact", async () => {
	const core = fakeCore();
	await renderProbe(core.api);
	await screen.findByText("0", { selector: "output" });
	await userEvent.click(screen.getByRole("button", { name: "Tick" }));
	await screen.findByText("1", { selector: "output" });
	await userEvent.click(screen.getByRole("button", { name: "Tick" }));
	await screen.findByText("2", { selector: "output" });
	expect(count()).toBe("2");
});

test("after losing its session it shows the error and starts again", async () => {
	const core = fakeCore();
	await renderProbe(core.api);
	await screen.findByText("0", { selector: "output" });
	await userEvent.click(screen.getByRole("button", { name: "Tick" }));
	await screen.findByText("1", { selector: "output" });

	act(() => core.restart());
	await userEvent.click(screen.getByRole("button", { name: "Tick" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"The match no longer exists in the core.",
	);
	await screen.findByText("0", { selector: "output" });

	await userEvent.click(screen.getByRole("button", { name: "Tick" }));
	await screen.findByText("1", { selector: "output" });
	expect(screen.queryByRole("alert")).toBeNull();
});
