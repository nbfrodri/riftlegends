import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	defaultSoundSettings,
	effectiveVolume,
	getSoundSettings,
	SOUND_STORAGE_KEY,
	setSoundSettings,
} from "../src/renderer/sound/settings";

beforeEach(() => localStorage.clear());
afterEach(() => setSoundSettings(defaultSoundSettings));

describe("sound volume (#472)", () => {
	test("the effective volume is master × effects", () => {
		expect(
			effectiveVolume({
				master: 50,
				effects: 80,
				masterMuted: false,
				effectsMuted: false,
			}),
		).toBeCloseTo(0.4);
		expect(
			effectiveVolume({
				master: 100,
				effects: 100,
				masterMuted: false,
				effectsMuted: false,
			}),
		).toBe(1);
	});

	test("muting either volume silences the effects", () => {
		const loud = { master: 100, effects: 100 };
		expect(
			effectiveVolume({ ...loud, masterMuted: true, effectsMuted: false }),
		).toBe(0);
		expect(
			effectiveVolume({ ...loud, masterMuted: false, effectsMuted: true }),
		).toBe(0);
	});

	test("the default is moderate and audible", () => {
		const volume = effectiveVolume(defaultSoundSettings);
		expect(volume).toBeGreaterThan(0.2);
		expect(volume).toBeLessThanOrEqual(0.5);
	});

	test("a change is stored and survives a reload; junk falls back to the default", () => {
		setSoundSettings({
			...defaultSoundSettings,
			master: 30,
			effectsMuted: true,
		});
		expect(JSON.parse(localStorage.getItem(SOUND_STORAGE_KEY) ?? "")).toEqual({
			...defaultSoundSettings,
			master: 30,
			effectsMuted: true,
		});
		expect(getSoundSettings({ reload: true })).toMatchObject({
			master: 30,
			effectsMuted: true,
		});
		localStorage.setItem(SOUND_STORAGE_KEY, '{"master":900,"effects":"x"}');
		expect(getSoundSettings({ reload: true })).toEqual(defaultSoundSettings);
	});
});
