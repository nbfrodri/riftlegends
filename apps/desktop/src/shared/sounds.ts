/** The sound effects: one per draft action (#472) and the button click (#493). */
export const soundIds = ["select", "pick", "lock", "ban", "click"] as const;
export type SoundId = (typeof soundIds)[number];

/** Encoded bytes of each verified official sound in the cache, by id. */
export type CachedSounds = Partial<Record<SoundId, Uint8Array>>;
