import { beforeEach, describe, expect, test, vi } from "vitest";
import { createSoundPlayer } from "../src/renderer/sound/player";
import type { CachedSounds } from "../src/shared/sounds";

/** A minimal Web Audio context: records decodes, buffers and started sources. */
function fakeContext() {
	const started: Array<{ buffer: unknown; gain: number; stopped: boolean }> =
		[];
	const context = {
		sampleRate: 48_000,
		state: "running",
		currentTime: 0,
		destination: {},
		resume: vi.fn(async () => undefined),
		decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({
			decoded: new Uint8Array(data)[0],
		})),
		createBuffer: vi.fn((channels: number, length: number, rate: number) => {
			const data = new Float32Array(length);
			return {
				synthesized: true,
				length,
				sampleRate: rate,
				numberOfChannels: channels,
				getChannelData: () => data,
			};
		}),
		createGain() {
			const node = {
				gain: { value: 1 },
				connect: vi.fn(),
			};
			return node;
		},
		createBufferSource() {
			let gain: { gain: { value: number } } | undefined;
			const source = {
				buffer: null as unknown,
				onended: null as (() => void) | null,
				connect: vi.fn((node: { gain: { value: number } }) => {
					gain = node;
					return node;
				}),
				start: vi.fn(() => {
					started.push(entry);
				}),
				stop: vi.fn(() => {
					entry.stopped = true;
				}),
			};
			const entry = {
				get buffer() {
					return source.buffer;
				},
				get gain() {
					return gain?.gain.value ?? 1;
				},
				stopped: false,
			};
			return source;
		},
	};
	return { context, started };
}

let fake: ReturnType<typeof fakeContext>;
let focused: boolean;
let volume: number;

const allCached: CachedSounds = {
	select: new Uint8Array([1]),
	pick: new Uint8Array([2]),
	lock: new Uint8Array([3]),
	ban: new Uint8Array([4]),
};

function player(load: () => Promise<CachedSounds> = async () => allCached) {
	return createSoundPlayer({
		createContext: () => fake.context as unknown as AudioContext,
		load,
		volume: () => volume,
		focused: () => focused,
	});
}

beforeEach(() => {
	fake = fakeContext();
	focused = true;
	volume = 0.4;
});

describe("sound player (#472)", () => {
	test("preloads the cached official sounds and plays each at the effective volume", async () => {
		const sounds = player();
		await sounds.preload();
		expect(fake.context.decodeAudioData).toHaveBeenCalledTimes(4);
		sounds.play("lock");
		expect(fake.started).toHaveLength(1);
		expect(fake.started[0]?.buffer).toEqual({ decoded: 3 });
		expect(fake.started[0]?.gain).toBeCloseTo(0.4);
	});

	test("without a cache every sound falls back to its own synthesized sound", async () => {
		const sounds = player(async () => ({}));
		await sounds.preload();
		expect(fake.context.decodeAudioData).not.toHaveBeenCalled();
		sounds.play("ban");
		expect(fake.started[0]?.buffer).toMatchObject({ synthesized: true });
	});

	test("a sound the context cannot decode also falls back", async () => {
		fake.context.decodeAudioData.mockRejectedValueOnce(new Error("bad ogg"));
		const sounds = player(async () => ({ select: new Uint8Array([9]) }));
		await sounds.preload();
		sounds.play("select");
		expect(fake.started[0]?.buffer).toMatchObject({ synthesized: true });
	});

	test("a failed cache read still leaves the fallback sounds", async () => {
		const sounds = player(async () => {
			throw new Error("no ipc");
		});
		await sounds.preload();
		sounds.play("pick");
		expect(fake.started).toHaveLength(1);
	});

	test("preloads once, however many screens ask", async () => {
		const load = vi.fn(async () => allCached);
		const sounds = player(load);
		await Promise.all([sounds.preload(), sounds.preload()]);
		await sounds.preload();
		expect(load).toHaveBeenCalledTimes(1);
	});

	test("muted (volume 0) plays nothing", async () => {
		const sounds = player();
		await sounds.preload();
		volume = 0;
		sounds.play("select");
		expect(fake.started).toHaveLength(0);
	});

	test("plays nothing while the window is in the background", async () => {
		const sounds = player();
		await sounds.preload();
		focused = false;
		sounds.play("select");
		expect(fake.started).toHaveLength(0);
	});

	test("never overlaps two of the same sound; different sounds may", async () => {
		const sounds = player();
		await sounds.preload();
		sounds.play("select");
		sounds.play("ban");
		sounds.play("select");
		expect(fake.started).toHaveLength(3);
		expect(fake.started.map((entry) => entry.stopped)).toEqual([
			true,
			false,
			false,
		]);
	});

	test("until the official sounds arrive, the fallback plays; then the official one", async () => {
		let release: (sounds: CachedSounds) => void = () => undefined;
		const sounds = player(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		const ready = sounds.preload();
		sounds.play("lock");
		expect(fake.started[0]?.buffer).toMatchObject({ synthesized: true });
		release(allCached);
		await ready;
		sounds.play("lock");
		expect(fake.started[1]?.buffer).toEqual({ decoded: 3 });
	});

	test("before any preload, nothing plays and nothing throws", () => {
		const sounds = player();
		expect(() => sounds.play("select")).not.toThrow();
		expect(fake.started).toHaveLength(0);
	});

	test("marks each sound it starts, for the end-to-end spy", async () => {
		const sounds = player();
		await sounds.preload();
		sounds.play("lock");
		expect(performance.getEntriesByName("sound:lock", "mark")).toHaveLength(1);
		sounds.play("lock");
		expect(performance.getEntriesByName("sound:lock", "mark")).toHaveLength(1);
	});
});

describe("fallback sounds (#472)", () => {
	test("each one is short, distinct and within the sample range", async () => {
		const { synthesize } = await import("../src/renderer/sound/fallback");
		const { soundIds } = await import("../src/shared/sounds");
		const samples = soundIds.map((id) => synthesize(id, 48_000));
		for (const data of samples) {
			expect(data.length).toBeGreaterThan(48_000 * 0.04);
			expect(data.length).toBeLessThan(48_000 * 0.7);
			expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(1);
			expect(Math.max(...data.map(Math.abs))).toBeGreaterThan(0.1);
			// Ends silent: no click when the source stops.
			expect(Math.abs(data.at(-1) ?? 1)).toBeLessThan(0.01);
		}
		expect(new Set(samples.map((data) => data.length)).size).toBe(
			soundIds.length,
		);
	});
});
