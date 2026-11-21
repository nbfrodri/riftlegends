import {
	CONTRACT_VERSION,
	draftCommands,
	parseCommand,
} from "@rift-legends/contracts";
import {
	draftDispatcher,
	draftStateWith,
	openSession,
	packagedDraftContent,
	packagedMatchContent,
	type SeriesState,
	type Session,
} from "@rift-legends/core";
import { createI18n } from "@rift-legends/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { CoreProvider } from "../src/renderer/core";
import type { CoreApi, CoreCommand, CoreFact } from "../src/shared/bridge";

/** The real draft dispatcher with the packaged content, behind the renderer's `CoreApi`. */
function draftCore() {
	const listeners = new Set<(facts: readonly CoreFact[]) => void>();
	const sent: CoreCommand[] = [];
	let session: Session<SeriesState> | null = null;
	// Facts applied by `act`, which the renderer did not send itself.
	let outside = 0;
	const notify = (facts: readonly CoreFact[]) => {
		for (const listener of [...listeners]) listener(facts);
	};
	const api = {
		open: vi.fn(async () => {
			session = openSession(
				1,
				draftStateWith(packagedDraftContent, packagedMatchContent),
			);
			return { ok: true as const, sessionId: 1 };
		}),
		send: vi.fn(async (command: CoreCommand) => {
			sent.push(command);
			const parsed = parseCommand(draftCommands, {
				...command,
				expectedPosition: command.expectedPosition + outside,
			});
			if (!parsed.ok || !session) throw new Error(JSON.stringify(parsed));
			const next = draftDispatcher.handle(session, parsed.command);
			session = next.session;
			if (next.response.ok) {
				outside = 0;
				notify(next.response.facts);
			}
			return next.response as never;
		}),
		query: vi.fn(async (query) => {
			if (!session) throw new Error("no session");
			return draftDispatcher.query(session, query as never);
		}),
		subscribe: (listener: (facts: readonly CoreFact[]) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	} satisfies CoreApi;
	/**
	 * Applies a command as if someone else sent it (an AI turn before #193).
	 * The renderer's next command is shifted by the facts it did not send.
	 */
	const act = (kind: string, payload: unknown) => {
		if (!session) throw new Error("no session");
		const parsed = parseCommand(draftCommands, {
			v: CONTRACT_VERSION,
			kind,
			sessionId: 1,
			expectedPosition: session.position,
			payload,
		});
		if (!parsed.ok) throw new Error(JSON.stringify(parsed));
		const next = draftDispatcher.handle(session, parsed.command);
		if (!next.response.ok) throw new Error(JSON.stringify(next.response));
		outside += next.response.facts.length;
		session = next.session;
		notify(next.response.facts);
	};
	return { api, sent, act };
}

/** Renders `ui` against a real draft core, in a locale (English by default). */
export async function renderWithDraftCore(ui: ReactElement, locale = "en-US") {
	const core = draftCore();
	const i18n = await createI18n(locale);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const view = render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<CoreProvider api={core.api}>{ui}</CoreProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
	return { ...view, ...core };
}
