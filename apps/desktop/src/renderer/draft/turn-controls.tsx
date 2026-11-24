import type { Side } from "@rift-legends/contracts";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clockTime } from "../match/playback";
import { pacing } from "./broadcast/pacing";
import { useDraftSession } from "./session";

const BAR = { blue: "bg-side-blue", red: "bg-side-red" } as const;
const steps = (seconds: number) =>
	Math.round((seconds * 1000 * 1000) / pacing.turnMs) / 1000;

/**
 * The turn timer (#419): a line in the picking side's colour that shrinks from
 * both ends to the centre. It animates its transform once over the whole turn;
 * with reduced motion it steps every second. The time left is screen-reader text.
 */
function Countdown(props: { side: Side }) {
	const { t } = useTranslation();
	const { send } = useDraftSession();
	const reduced = useReducedMotion();
	const bar = useRef<HTMLDivElement>(null);
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
	useLayoutEffect(() => {
		const line = bar.current;
		if (reduced || !line) return;
		// Commit the full line before starting its one transition to empty.
		line.getBoundingClientRect();
		line.style.transitionProperty = "transform";
		line.style.transitionDuration = `${pacing.turnMs}ms`;
		line.style.transitionTimingFunction = "linear";
		line.style.transform = "scaleX(0)";
	}, [reduced]);
	return (
		<div
			role="timer"
			aria-label={t("draft.timer.label")}
			className="w-[clamp(140px,14vw,220px)]"
		>
			<p className="text-center text-xs font-bold uppercase tracking-wider text-muted">
				{t("draft.timer.label")}
			</p>
			<div className="mt-1.5 h-1 overflow-hidden bg-line/50">
				<div
					ref={bar}
					data-timer-bar
					className={`h-full origin-center ${BAR[props.side]}`}
					style={
						reduced ? { transform: `scaleX(${steps(seconds)})` } : undefined
					}
				/>
			</div>
			<span className="sr-only">{clockTime(seconds)}</span>
		</div>
	);
}

export function TurnControls() {
	const { view, timer, send, mine, present, presentation } = useDraftSession();
	const turn = view?.turn;
	useEffect(() => {
		if (presentation || !mine || !turn || turn.team === mine) return;
		const id = window.setTimeout(async () => {
			const ok = await send("draft.ai", {});
			if (ok && turn.action === "side" && turn.options.length === 2)
				present("side");
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
			side={turn.side}
			key={
				turn.action +
				view[turn.side][turn.action === "ban" ? "bans" : "picks"].length
			}
		/>
	);
}
