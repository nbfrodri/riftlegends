import {
	CONTRACT_VERSION,
	draftCommands,
	parseCommand,
} from "@rift-legends/contracts";
import {
	draftDispatcher,
	draftStateWith,
	loadRealContent,
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
import { AssetsProvider } from "../src/renderer/assets";
import { CoreProvider } from "../src/renderer/core";
import type {
	AssetsApi,
	CoreApi,
	CoreCommand,
	CoreFact,
} from "../src/shared/bridge";

/** The real content set, as the core host offers it (plan 11). */
const real = () => {
	const { draft, match } = loadRealContent();
	return { content: draft, match };
};

/** The real draft dispatcher with the packaged content, behind the renderer's `CoreApi`. */
function draftCore(match = packagedMatchContent, draft = packagedDraftContent) {
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
			session = openSession(1, draftStateWith(draft, match, { real }));
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

/** Fix the setup's root seed so component tests exercise a known draw. */
export function seedNextSeries(seed = 7) {
	vi.spyOn(crypto, "getRandomValues").mockReturnValueOnce(
		new Uint32Array([seed]),
	);
}

/** Distinct display names reveal places that still render a champion ID. */
export const namedDraft = {
	...packagedDraftContent,
	champions: packagedDraftContent.champions.map((c) => ({
		...c,
		name: `The Unforgotten Guardian of ${c.name}`,
	})),
};

/**
 * Renders `ui` against a real draft core, in a locale (English by default).
 * With `assets`, the asset cache is that fake bridge.
 */
export async function renderWithDraftCore(
	ui: ReactElement,
	locale = "en-US",
	match = packagedMatchContent,
	draft = packagedDraftContent,
	{ assets }: { assets?: AssetsApi } = {},
) {
	const core = draftCore(match, draft);
	const i18n = await createI18n(locale);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const view = render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={client}>
				<CoreProvider api={core.api}>
					{assets ? <AssetsProvider api={assets}>{ui}</AssetsProvider> : ui}
				</CoreProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
	return { ...view, ...core, i18n };
}
