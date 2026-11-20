const UINT32_MAX = 0xffffffff;
const FNV_OFFSET = 2166136261;

/**
 * FNV-1a 32-bit over `[root, scope, ...ids]`, each a uint32 in little-endian.
 * Changing the encoding or the hash is a `sim_version` change.
 */
export function deriveSeed(
	root: number,
	scope: number,
	...ids: number[]
): number {
	let hash = FNV_OFFSET;
	for (const word of [root, scope, ...ids]) {
		if (!Number.isInteger(word) || word < 0 || word > UINT32_MAX) {
			throw new RangeError(`Seed word must be a uint32, got ${word}`);
		}
		for (let shift = 0; shift < 32; shift += 8) {
			hash ^= (word >>> shift) & 255;
			// hash * 16777619 (2^24 + 2^8 + 0x93) mod 2^32, exact in doubles.
			hash = ((hash << 24) + (hash << 8) + (hash >>> 0) * 0x93) >>> 0;
		}
	}
	return hash;
}
