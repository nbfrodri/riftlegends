import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { useEffect, useState } from "react";

export const clockTime = (seconds: number) =>
	[Math.floor(seconds / 60), seconds % 60]
		.map((n) => String(n).padStart(2, "0"))
		.join(":");

// One game minute in five real seconds, sampled four times per second at all speeds.
const GAME_SECONDS_PER_MS = 60 / 5000;
const SAMPLE_MS = 250;
export const speeds = ["1", "4", "16"] as const;
export function usePlayback(duration: number) {
	const reduceMotion = useReducedMotion();
	const [second, seek] = useState(reduceMotion ? duration : 0);
	const [paused, pause] = useState(false);
	const [speed, setSpeed] = useState<(typeof speeds)[number]>("1");
	const ended = second >= duration;
	useEffect(() => {
		if (reduceMotion) {
			seek(duration);
			return;
		}
		if (paused || ended) return;
		const start = performance.now();
		let advanced = 0;
		const interval = window.setInterval(() => {
			const elapsed = Math.floor(
				(performance.now() - start) * GAME_SECONDS_PER_MS * Number(speed),
			);
			const step = elapsed - advanced;
			advanced = elapsed;
			seek((current) => Math.min(duration, current + step));
		}, SAMPLE_MS);
		return () => window.clearInterval(interval);
	}, [duration, paused, speed, ended, reduceMotion]);
	return {
		second,
		ended,
		paused,
		pause,
		speed,
		setSpeed,
		skip: () => seek(duration),
	};
}
