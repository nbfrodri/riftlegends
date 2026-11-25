/**
 * The sound effects: one per draft action (#472), the button click (#493) and
 * the turn timer's countdown tick (#505) and the Roles swap (#512).
 */
export const soundIds = [
	"select",
	"pick",
	"lock",
	"ban",
	"click",
	"swap",
	"tick",
] as const;
export type SoundId = (typeof soundIds)[number];

/** Encoded bytes of each verified official sound in the cache, by id. */
export type CachedSounds = Partial<Record<SoundId, Uint8Array>>;
