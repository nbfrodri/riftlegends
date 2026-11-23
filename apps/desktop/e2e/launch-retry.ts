// CI (#391): once in a while Chromium cannot connect to the Xvfb display and
// Electron exits at start-up with "Missing X server or $DISPLAY" while the
// other launches on the same display work. The cause is the display, not the
// app, so only that exact error is retried, a bounded number of times. Any
// other launch failure is a real failure and is thrown at once.
const DISPLAY_FAILURE = "Missing X server or $DISPLAY";

export function isDisplayLaunchFailure(error: unknown): boolean {
	return error instanceof Error && error.message.includes(DISPLAY_FAILURE);
}

export async function withLaunchRetry<T>(
	launch: () => Promise<T>,
	{ attempts = 3, delayMs = 1000 } = {},
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await launch();
		} catch (error) {
			if (attempt >= attempts || !isDisplayLaunchFailure(error)) throw error;
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}
