import type { CachedSounds, SoundId } from "../../shared/sounds";
import { createSoundPlayer } from "./player";
import { effectiveVolume, getSoundSettings } from "./settings";

let load: () => Promise<CachedSounds> = async () => ({});

const player = createSoundPlayer({
	createContext: () =>
		typeof AudioContext === "undefined" ? undefined : new AudioContext(),
	load: () => load(),
	volume: () => effectiveVolume(getSoundSettings()),
	focused: () => document.hasFocus(),
});

/** Decodes the draft sounds once; `cached` reads the official ones from main. */
export function preloadSounds(cached?: () => Promise<CachedSounds>): void {
	if (cached) load = cached;
	void player.preload();
}

export function playSound(id: SoundId): void {
	player.play(id);
}
