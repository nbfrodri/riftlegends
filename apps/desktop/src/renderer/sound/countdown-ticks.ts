/**
 * The client ticks while the player's own ban or pick has 10 s or less left
 * (`actionSoundThreshold` in its champ-select plugin), once per second.
 */
export const COUNTDOWN_SECONDS = 10;

/**
 * Plays one tick per second over the last seconds before `deadline`
 * (`performance.now()` time), at 10, 9 ... 1 s left. One timer per tick, set
 * once: nothing renders or runs per frame (S1). Returns the stop function.
 */
export function startCountdownTicks(
	deadline: number,
	play: () => void,
): () => void {
	const now = performance.now();
	const timers: ReturnType<typeof setTimeout>[] = [];
	for (let left = COUNTDOWN_SECONDS; left >= 1; left--) {
		const delay = deadline - left * 1000 - now;
		if (delay >= 0) timers.push(setTimeout(play, delay));
	}
	return () => {
		for (const timer of timers) clearTimeout(timer);
	};
}
