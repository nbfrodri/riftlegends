import type { SoundId } from "../../shared/sounds";

/** A tone whose frequency glides from `from` to `to` Hz over the sound. */
interface Voice {
	from: number;
	to: number;
	gain: number;
}

/** Our own sounds, synthesized: nothing from Riot, no files to license. */
const recipes: Record<
	SoundId,
	{ seconds: number; decay: number; voices: Voice[] }
> = {
	select: {
		seconds: 0.07,
		decay: 60,
		voices: [{ from: 1900, to: 1500, gain: 0.5 }],
	},
	click: {
		seconds: 0.05,
		decay: 80,
		voices: [{ from: 1200, to: 900, gain: 0.35 }],
	},
	swap: {
		seconds: 0.2,
		decay: 16,
		voices: [
			{ from: 880, to: 660, gain: 0.3 },
			{ from: 660, to: 880, gain: 0.3 },
		],
	},
	pick: {
		seconds: 0.26,
		decay: 14,
		voices: [
			{ from: 660, to: 990, gain: 0.35 },
			{ from: 1320, to: 1980, gain: 0.12 },
		],
	},
	lock: {
		seconds: 0.42,
		decay: 9,
		voices: [
			{ from: 523, to: 523, gain: 0.32 },
			{ from: 784, to: 784, gain: 0.26 },
			{ from: 1046, to: 1046, gain: 0.12 },
		],
	},
	ban: {
		seconds: 0.34,
		decay: 11,
		voices: [
			{ from: 240, to: 110, gain: 0.45 },
			{ from: 480, to: 220, gain: 0.15 },
		],
	},
};

/** Mono samples in [-1, 1]: a decaying envelope that ends in silence. */
export function synthesize(id: SoundId, sampleRate: number): Float32Array {
	const { seconds, decay, voices } = recipes[id];
	const length = Math.round(seconds * sampleRate);
	const data = new Float32Array(length);
	const phases = voices.map(() => 0);
	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const progress = i / length;
		// A 3 ms attack avoids a click; the taper reaches zero at the end.
		const envelope =
			Math.min(1, t / 0.003) * Math.exp(-decay * t) * (1 - progress);
		let sample = 0;
		voices.forEach((voice, v) => {
			const frequency = voice.from + (voice.to - voice.from) * progress;
			phases[v] = (phases[v] ?? 0) + (2 * Math.PI * frequency) / sampleRate;
			sample += voice.gain * Math.sin(phases[v] ?? 0);
		});
		data[i] = Math.max(-1, Math.min(1, sample * envelope));
	}
	return data;
}
