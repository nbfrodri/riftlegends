import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	CoreErrorMessage,
	type CoreRequestError,
	useOpenSession,
} from "../core";
import { TournamentSetup } from "./tournament-setup";

/**
 * The `/torneo` route (plan 31): its own core session, so the tournament never
 * touches the draft or the exhibition season. A new tournament opens a new one.
 */
export function TournamentScreen() {
	const { t } = useTranslation();
	const openSession = useOpenSession();
	const [sessionId, setSessionId] = useState<number | null>(null);
	const [failure, setFailure] = useState<CoreRequestError | null>(null);
	const [round, setRound] = useState(0);

	useEffect(() => {
		let live = true;
		void round;
		openSession().then(
			(id) => live && setSessionId(id),
			(caught) => live && setFailure(caught as CoreRequestError),
		);
		return () => {
			live = false;
		};
	}, [openSession, round]);

	return (
		<section className="flex min-h-full flex-col gap-gap px-gutter py-[clamp(16px,2.5vh,26px)] short:gap-3 short:py-3.5">
			<header>
				<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] leading-none tracking-heading">
					{t("tournament.title")}
				</h1>
				<p className="mt-1.5 text-muted">{t("tournament.intro")}</p>
			</header>
			{failure && <CoreErrorMessage error={failure} />}
			{sessionId !== null && (
				<TournamentSetup
					key={sessionId}
					sessionId={sessionId}
					onNew={() => setRound((count) => count + 1)}
				/>
			)}
		</section>
	);
}
