import type { Side } from "@rift-legends/contracts";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clockTime } from "../match/playback";
import { playSound } from "../sound";
import {
	COUNTDOWN_SECONDS,
	startCountdownTicks,
} from "../sound/countdown-ticks";
import { pacing } from "./broadcast/pacing";
import { useDraftSession } from "./session";

// Full class names, so Tailwind finds them. The glow follows the side colour.
const BAR = {
	blue: "bg-side-blue shadow-[0_0_8px_var(--color-side-blue)]",
	red: "bg-side-red shadow-[0_0_8px_var(--color-side-red)]",
} as const;
const steps = (seconds: number) =>
	Math.round((seconds * 1000 * 1000) / pacing.turnMs) / 1000;

/**
 * The turn timer (#419): an 8 px line with a soft glow in the picking side's colour that shrinks from
 * both ends to the centre, laid over the gap above the board so it spans both
 * team columns and the pool without taking height. It animates its transform once over the whole turn;
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
		// The client's tick over the last 10 s, from the same deadline (#505).
		const stopTicks = startCountdownTicks(deadline, () => playSound("tick"));
		const timeout = window.setTimeout(
			() => void send("draft.timeout", {}),
			pacing.turnMs,
		);
		return () => {
			window.clearInterval(tick);
			window.clearTimeout(timeout);
			stopTicks();
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
	const urgent = seconds <= COUNTDOWN_SECONDS;
	return (
		<div
			role="timer"
			aria-label={t("draft.timer.label")}
			className="pointer-events-none absolute inset-x-0 bottom-full mb-1 h-2 bg-line/50"
		>
			<div
				ref={bar}
				data-timer-bar
				data-urgent={urgent || undefined}
				// Brighter in the last seconds, in step with the ticks (#505).
				className={`h-full origin-center ${BAR[props.side]} ${urgent ? "brightness-125" : ""}`}
				style={reduced ? { transform: `scaleX(${steps(seconds)})` } : undefined}
			/>
			<span className="sr-only">{clockTime(seconds)}</span>
		</div>
	);
}

/** Lets the AI act on its own turns after a short pause; renders nothing. */
export function TurnControls() {
	const { view, send, mine, present, presentation } = useDraftSession();
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

	return null;
}

/** The turn timer above the board, on the user's own ban or pick (#419). */
export function TurnTimer() {
	const { view, timer, mine, presentation } = useDraftSession();
	const turn = view?.turn;
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
