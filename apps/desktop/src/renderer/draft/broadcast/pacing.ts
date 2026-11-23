// Milliseconds. The Electron frame meter samples the same animation windows.
export const pacing = {
	aiPauseMs: 800,
	// Only bans and picks can expire in the core. Each human turn gets 30 s.
	turnMs: 30_000,
	sweepMs: 320,
	captionDelayMs: 480,
	captionEnterMs: 120,
	ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
};
