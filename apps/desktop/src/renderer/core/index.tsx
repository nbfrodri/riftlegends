import type { CoreError } from "@rift-legends/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import type {
	CoreApi,
	CoreCommand,
	CoreFact,
	CoreQuery,
} from "../../shared/bridge";

/** A request the core answered with `{ ok: false, error }`. */
export class CoreRequestError extends Error {
	constructor(readonly error: CoreError) {
		super(error.code);
		this.name = "CoreRequestError";
	}
}

const CoreContext = createContext<CoreApi | null>(null);

/** Supplies the core API; the app passes `window.riftlegends.core`. */
export function CoreProvider(props: { api: CoreApi; children: ReactNode }) {
	return <CoreContext value={props.api}>{props.children}</CoreContext>;
}

const useCore = () => {
	const api = use(CoreContext);
	if (!api) throw new Error("useCore needs a CoreProvider");
	return api;
};

/** Calls `listener` with each batch of facts while the component is mounted. */
export function useFacts(listener: (facts: readonly CoreFact[]) => void) {
	const core = useCore();
	const latest = useRef(listener);
	latest.current = listener;
	useEffect(() => core.subscribe((facts) => latest.current(facts)), [core]);
}

/**
 * Reads a view of the core. It is fetched again only when a fact for which
 * `affectedBy` is true arrives (plan 04, R2).
 */
export function useCoreQuery<View>(
	query: CoreQuery,
	options: { affectedBy: (fact: CoreFact) => boolean },
) {
	const core = useCore();
	const client = useQueryClient();
	const queryKey = ["core", query.sessionId, query.kind, query.params];
	useFacts((facts) => {
		if (facts.some(options.affectedBy)) {
			void client.invalidateQueries({ queryKey, exact: true });
		}
	});
	return useQuery<View, CoreRequestError>({
		queryKey,
		queryFn: async () => {
			const result = await core.query(query);
			if (!result.ok) throw new CoreRequestError(result.error);
			return result.view as View;
		},
	});
}

const lostCodes = new Set([
	"unknown-session",
	"core-restarted",
	"core-timeout",
]);

/** True when the core no longer has the session the request was for. */
export const sessionLost = (error: CoreRequestError) =>
	lostCodes.has(error.error.code);

/**
 * Opens a session and drops any cached view under its id: a restarted core
 * numbers its sessions from 1 again.
 */
export function useOpenSession() {
	const core = useCore();
	const client = useQueryClient();
	return useCallback(async () => {
		const result = await core.open();
		if (!result.ok) throw new CoreRequestError(result.error);
		await client.resetQueries({ queryKey: ["core", result.sessionId] });
		return result.sessionId;
	}, [core, client]);
}

/** Sends commands; a rejection becomes a `CoreRequestError`. */
export function useCoreCommand() {
	const core = useCore();
	return useMutation<
		{ ok: true; position: number; facts: CoreFact[] },
		CoreRequestError,
		CoreCommand
	>({
		mutationFn: async (command) => {
			const result = await core.send(command);
			if (!result.ok) throw new CoreRequestError(result.error);
			return result;
		},
	});
}

/** The translated text of a core error (plan 04, R3). */
export function CoreErrorMessage({ error }: { error: CoreRequestError }) {
	const { t } = useTranslation();
	return (
		<p role="alert">{t(`errors.${error.error.code}`, error.error.params)}</p>
	);
}
