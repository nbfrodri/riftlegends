import { CONTRACT_VERSION, type CoreError } from "@rift-legends/contracts";
import { createI18n } from "@rift-legends/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, test, vi } from "vitest";
import {
	CoreErrorMessage,
	CoreProvider,
	useCoreCommand,
	useCoreQuery,
	useFacts,
} from "../src/renderer/core";
import type { CoreApi, CoreFact } from "../src/shared/bridge";

afterEach(cleanup);

/** An in-memory core with the debug catalog. */
function fakeCore() {
	const listeners = new Set<(facts: readonly CoreFact[]) => void>();
	let count = 0;
	let failure: CoreError | null = null;
	const api = {
		open: vi.fn(async () => ({ ok: true as const, sessionId: 1 })),
		send: vi.fn(async () => {
			if (failure) return { ok: false as const, error: failure };
			count += 1;
			const facts = [{ type: "debug.ticked", position: count - 1, count }];
			for (const listener of [...listeners]) listener(facts);
			return { ok: true as const, position: count, facts };
		}),
		query: vi.fn(async () =>
			failure
				? { ok: false as const, error: failure }
				: { ok: true as const, view: { count } },
		),
		subscribe: (listener: (facts: readonly CoreFact[]) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	} satisfies CoreApi;
	const emit = (facts: readonly CoreFact[]) => {
		for (const listener of [...listeners]) listener(facts);
	};
	return {
		api,
		emit,
		fail: (error: CoreError | null) => {
			failure = error;
		},
	};
}

async function renderWithCore(ui: ReactNode, api: CoreApi, locale = "en-US") {
	const i18n = await createI18n(locale);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const view = render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<CoreProvider api={api}>{ui}</CoreProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
	return { ...view, i18n };
}

const countQuery = {
	v: CONTRACT_VERSION,
	kind: "debug.count",
	sessionId: 1,
	params: {},
} as const;

function Counter() {
	const count = useCoreQuery<{ count: number }>(countQuery, {
		affectedBy: (fact) => fact.type === "debug.ticked",
	});
	if (count.error) return <CoreErrorMessage error={count.error} />;
	return <output>{count.data?.count ?? "…"}</output>;
}

test("a query refetches when a fact affects its view (R2)", async () => {
	const core = fakeCore();
	await renderWithCore(<Counter />, core.api);
	expect(await screen.findByText("0")).toBeTruthy();
	expect(core.api.query).toHaveBeenCalledTimes(1);

	act(() => core.emit([{ type: "debug.other", position: 0 }]));
	await act(async () => {});
	expect(core.api.query).toHaveBeenCalledTimes(1);

	await act(async () => {
		await core.api.send();
	});
	expect(await screen.findByText("1")).toBeTruthy();
	expect(core.api.query).toHaveBeenCalledTimes(2);
});

function Listener(props: { onFacts: (facts: readonly CoreFact[]) => void }) {
	useFacts(props.onFacts);
	return null;
}

test("useFacts hands every batch of facts to its listener", async () => {
	const core = fakeCore();
	const seen: unknown[] = [];
	const { unmount } = await renderWithCore(
		<Listener onFacts={(facts) => seen.push(facts)} />,
		core.api,
	);
	const facts = [{ type: "debug.ticked", position: 0, count: 1 }];
	act(() => core.emit(facts));
	unmount();
	act(() => core.emit(facts));
	expect(seen).toEqual([facts]);
});

function Ticker() {
	const tick = useCoreCommand();
	return (
		<>
			<button
				type="button"
				onClick={() =>
					tick.mutate({
						v: CONTRACT_VERSION,
						kind: "debug.tick",
						sessionId: 1,
						expectedPosition: 0,
						payload: {},
					})
				}
			>
				tick
			</button>
			{tick.data && <output>{tick.data.position}</output>}
			{tick.error && <CoreErrorMessage error={tick.error} />}
		</>
	);
}

test("a command resolves with the core's response", async () => {
	const core = fakeCore();
	await renderWithCore(<Ticker />, core.api);
	await userEvent.click(screen.getByRole("button", { name: "tick" }));
	expect(await screen.findByText("1")).toBeTruthy();
});

test("a core error shows its translated text (R3)", async () => {
	const core = fakeCore();
	core.fail({ code: "core-timeout", params: {} });
	const { i18n } = await renderWithCore(<Ticker />, core.api);
	await userEvent.click(screen.getByRole("button", { name: "tick" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"The core did not answer in time.",
	);

	await act(async () => {
		await i18n.changeLanguage("es");
	});
	expect(screen.getByRole("alert").textContent).toBe(
		"El núcleo no respondió a tiempo.",
	);
});

test("a failed query shows its translated error with its params", async () => {
	const core = fakeCore();
	core.fail({
		code: "contract-mismatch",
		params: { expected: 1, received: 2 },
	});
	await renderWithCore(<Counter />, core.api, "es-ES");
	expect((await screen.findByRole("alert")).textContent).toBe(
		"La interfaz y el núcleo son de versiones distintas (2 frente a 1). Reinicia el juego.",
	);
});
