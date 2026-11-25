/** Volumes from 0 to 100; a muted volume keeps its level for unmuting. */
export interface SoundSettings {
	master: number;
	effects: number;
	masterMuted: boolean;
	effectsMuted: boolean;
}

export const SOUND_STORAGE_KEY = "riftlegends.sound";

/** Moderate by default: 50 % × 80 % = 40 % of full scale. */
export const defaultSoundSettings: SoundSettings = Object.freeze({
	master: 50,
	effects: 80,
	masterMuted: false,
	effectsMuted: false,
});

const isLevel = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= 100;

function parse(value: unknown): SoundSettings | null {
	if (typeof value !== "object" || value === null) return null;
	const { master, effects, masterMuted, effectsMuted } = value as Record<
		string,
		unknown
	>;
	return isLevel(master) &&
		isLevel(effects) &&
		typeof masterMuted === "boolean" &&
		typeof effectsMuted === "boolean"
		? { master, effects, masterMuted, effectsMuted }
		: null;
}

// Storage may be unavailable or hold junk: it must never block the app.
function stored(): SoundSettings {
	try {
		const raw = localStorage.getItem(SOUND_STORAGE_KEY);
		return (raw && parse(JSON.parse(raw))) || defaultSoundSettings;
	} catch {
		return defaultSoundSettings;
	}
}

let current: SoundSettings | undefined;
const listeners = new Set<() => void>();

export function getSoundSettings({ reload = false } = {}): SoundSettings {
	if (!current || reload) current = stored();
	return current;
}

export function setSoundSettings(next: SoundSettings): void {
	current = { ...next };
	try {
		localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(current));
	} catch {
		// The change still applies for this session.
	}
	for (const listener of listeners) listener();
}

export function subscribeSoundSettings(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The gain of an effect: master × effects, and 0 when either is muted. */
export function effectiveVolume(settings: SoundSettings): number {
	if (settings.masterMuted || settings.effectsMuted) return 0;
	return (settings.master / 100) * (settings.effects / 100);
}
