/** The draft's sound effects (#472): one per draft action. */
export const soundIds = ["select", "pick", "lock", "ban"] as const;
export type SoundId = (typeof soundIds)[number];

/** Encoded bytes of each verified official sound in the cache, by id. */
export type CachedSounds = Partial<Record<SoundId, Uint8Array>>;
