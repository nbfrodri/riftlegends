import { encodeFact } from "@rift-legends/contracts";
import * as content from "./content/data";

/**
 * Version of the simulation rules. Bump it whenever the facts produced for
 * the same seed and commands change on purpose (algorithm, RNG library,
 * scoring formulas...). Goldens are bound to it.
 */
export const SIM_VERSION = 12;

/** FNV-1a over canonical JSON encoded as UTF-16 little-endian. */
export function contentVersionOf(data: object): number {
	const json = encodeFact(data);
	let hash = 2166136261n;
	const addByte = (byte: number) =>
		((hash ^ BigInt(byte)) * 16777619n) & 0xffffffffn;
	for (let i = 0; i < json.length; i++) {
		const unit = json.charCodeAt(i);
		hash = addByte(unit & 255);
		hash = addByte(unit >>> 8);
	}
	return Number(hash);
}

export const CONTENT_VERSION = contentVersionOf(content);
