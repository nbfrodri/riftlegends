import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clockTime } from "../match/playback";
import { pacing } from "./broadcast/pacing";
import { useDraftSession } from "./session";

function Countdown() {
	const { t } = useTranslation();
	const { send } = useDraftSession();
	const [seconds, setSeconds] = useState(pacing.turnMs / 1000);
	useEffect(() => {
		const deadline = performance.now() + pacing.turnMs;
		const tick = window.setInterval(() => {
			setSeconds(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
		}, 1000);
		const timeout = window.setTimeout(
			() => void send("draft.timeout", {}),
			pacing.turnMs,
		);
		return () => {
			window.clearInterval(tick);
			window.clearTimeout(timeout);
		};
	}, [send]);
	return (
		<div className="text-right">
			<p className="text-xs font-bold uppercase tracking-wider text-muted">
				{t("draft.timer.label")}
			</p>
			<time
				role="timer"
				aria-label={t("draft.timer.label")}
				className="text-[32px] font-bold leading-none tabular-nums"
			>
				{clockTime(seconds)}
			</time>
		</div>
	);
}

export function TurnControls() {
	const { view, timer, send, mine, present, presentation } = useDraftSession();
	const turn = view?.turn;
	useEffect(() => {
		if (presentation === "side") {
			const id = window.setTimeout(() => present(null), pacing.sideResultMs);
			return () => window.clearTimeout(id);
		}
		if (presentation || !mine || !turn || turn.team === mine) return;
		const id = window.setTimeout(async () => {
			const ok = await send("draft.ai", {});
			if (ok && turn.action === "side") present("side");
		}, pacing.aiPauseMs);
		return () => window.clearTimeout(id);
	}, [turn, mine, presentation, send, present]);

	if (
		!view ||
		!timer ||
		presentation ||
		!turn ||
		turn.team !== mine ||
		(turn.action !== "ban" && turn.action !== "pick")
	)
		return null;
	return (
		<Countdown
			key={
				turn.action +
				view[turn.side][turn.action === "ban" ? "bans" : "picks"].length
			}
		/>
	);
}
