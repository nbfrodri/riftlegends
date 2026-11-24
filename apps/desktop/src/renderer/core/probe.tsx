import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	CoreErrorMessage,
	sessionLost,
	useCoreCommand,
	useCoreQuery,
	useOpenSession,
} from ".";

function Count({ sessionId }: { sessionId: number }) {
	const count = useCoreQuery<{ count: number }>(
		{ v: 1, kind: "debug.count", sessionId, params: {} },
		{ affectedBy: (fact) => fact.type === "debug.ticked" },
	);
	return <output>{count.data?.count}</output>;
}

/**
 * Test-only panel (plan 04, E1): drives the debug catalog through the real
 * renderer API. Shown only when the app starts with RIFT_E2E_PROBE=1.
 */
export function CoreProbe() {
	const { t } = useTranslation();
	const tick = useCoreCommand();
	const openSession = useOpenSession();
	const [session, setSession] = useState<{ id: number; position: number }>();

	const open = useCallback(async () => {
		setSession({ id: await openSession(), position: 0 });
	}, [openSession]);
	useEffect(() => {
		void open();
	}, [open]);

	return (
		<section aria-label={t("coreProbe.title")} className="flex gap-3 p-3">
			{session && <Count key={session.id} sessionId={session.id} />}
			<button
				type="button"
				disabled={!session || tick.isPending}
				className="cursor-pointer disabled:cursor-default"
				onClick={() =>
					session &&
					tick.mutate(
						{
							v: 1,
							kind: "debug.tick",
							sessionId: session.id,
							expectedPosition: session.position,
							payload: {},
						},
						{
							onSuccess: ({ position }) =>
								setSession({ id: session.id, position }),
							onError: (error) => {
								if (sessionLost(error)) void open();
							},
						},
					)
				}
			>
				{t("coreProbe.tick")}
			</button>
			{tick.error && <CoreErrorMessage error={tick.error} />}
		</section>
	);
}
