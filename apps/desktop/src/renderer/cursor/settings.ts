export const GAME_CURSOR_STORAGE_KEY = "riftlegends.gameCursor";

// Storage may be unavailable or hold junk: it must never block the app.
function stored(): boolean {
	try {
		return localStorage.getItem(GAME_CURSOR_STORAGE_KEY) !== "false";
	} catch {
		return true;
	}
}

let current: boolean | undefined;
const listeners = new Set<() => void>();

/** The game cursor is on unless the player turned it off (#515). */
export function getGameCursor({ reload = false } = {}): boolean {
	if (current === undefined || reload) current = stored();
	return current;
}

function mark(enabled: boolean) {
	document.documentElement.dataset.gameCursor = enabled ? "on" : "off";
}

/** Marks the document from the stored choice; call once at startup. */
export function initGameCursor(): void {
	mark(getGameCursor({ reload: true }));
}

export function setGameCursor(enabled: boolean): void {
	current = enabled;
	mark(enabled);
	try {
		localStorage.setItem(GAME_CURSOR_STORAGE_KEY, String(enabled));
	} catch {
		// The change still applies for this session.
	}
	for (const listener of listeners) listener();
}

export function subscribeGameCursor(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
