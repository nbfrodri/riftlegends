import { type CachedSounds, type SoundId, soundIds } from "../../shared/sounds";
import { synthesize } from "./fallback";

interface PlayerOptions {
	/** Undefined where Web Audio is missing (tests): then nothing plays. */
	createContext: () => AudioContext | undefined;
	/** The verified official sounds from the cache. */
	load: () => Promise<CachedSounds>;
	/** The effective effects volume, read at each play. */
	volume: () => number;
	/** False while the window is in the background. */
	focused: () => boolean;
}

/**
 * Plays the draft's short effects with Web Audio. Every sound is decoded
 * once, ahead of time, so a play only starts a buffer: it never blocks the
 * frame that shows the draft action (S1). Our own synthesized sounds stand
 * in until the official ones are decoded, or for good without a cache.
 */
export function createSoundPlayer(options: PlayerOptions) {
	let context: AudioContext | undefined;
	let preloading: Promise<void> | undefined;
	const buffers = new Map<SoundId, AudioBuffer>();
	const playing = new Map<SoundId, AudioBufferSourceNode>();

	async function decode(audio: AudioContext, id: SoundId, bytes: Uint8Array) {
		try {
			// decodeAudioData detaches its argument: hand it a copy.
			buffers.set(id, await audio.decodeAudioData(bytes.slice().buffer));
		} catch {
			// The synthesized sound stays.
		}
	}

	return {
		preload(): Promise<void> {
			if (preloading) return preloading;
			context = options.createContext();
			const audio = context;
			if (!audio) {
				preloading = Promise.resolve();
				return preloading;
			}
			for (const id of soundIds) {
				const data = synthesize(id, audio.sampleRate);
				const buffer = audio.createBuffer(1, data.length, audio.sampleRate);
				buffer.getChannelData(0).set(data);
				buffers.set(id, buffer);
			}
			preloading = options
				.load()
				.then(async (cached) => {
					await Promise.all(
						soundIds.map((id) => {
							const bytes = cached[id];
							return bytes ? decode(audio, id, bytes) : undefined;
						}),
					);
				})
				.catch(() => undefined);
			return preloading;
		},

		play(id: SoundId): void {
			const buffer = buffers.get(id);
			const volume = options.volume();
			if (!context || !buffer || volume <= 0 || !options.focused()) return;
			if (context.state === "suspended") void context.resume();
			// Never two of the same sound at once: the new one replaces it.
			playing.get(id)?.stop();
			const gain = context.createGain();
			gain.gain.value = volume;
			gain.connect(context.destination);
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(gain);
			source.onended = () => {
				if (playing.get(id) === source) playing.delete(id);
			};
			playing.set(id, source);
			source.start();
			// Lets the end-to-end test see what played, without touching audio.
			performance.clearMarks(`sound:${id}`);
			performance.mark(`sound:${id}`);
		},
	};
}
