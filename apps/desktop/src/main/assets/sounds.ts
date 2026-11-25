import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import type { CachedSounds, SoundId } from "../../shared/sounds";
import type { AssetFile } from "./catalog";
import { cachePath, readBytes } from "./disk";
import { downloadFile } from "./download";
import { type AssetTransport, NetworkUnavailable } from "./transport";

/** An official sound: where it lives and the exact bytes expected. */
export interface SoundSource {
	id: SoundId;
	url: string;
	size: number;
	sha256: string;
}

const maxSoundBytes = 256 * 1024;
const origin = "https://raw.communitydragon.org";
// A fixed patch, so the pinned digests keep matching after new patches.
const champSelect = `${origin}/16.23/plugins/rcp-fe-lol-champ-select/global/default/sounds`;

/**
 * The client's champ-select sounds (#472), its small UI click (#493) and the
 * countdown tick it plays in the last 10 s of the player's own ban or pick (#505)
 * and the trade-accepted sound for Roles swaps (#512). Riot's files are downloaded at
 * runtime and never shipped; only their names and digests live here.
 */
export const championSelectSounds: readonly SoundSource[] = [
	{
		id: "select",
		url: `${champSelect}/sfx-uikit-grid-click.ogg`,
		size: 15_405,
		sha256: "f6ef880fc6b87c04329681d88f1893ec2d11ea6e7c3e5a24e627ff5f77481f73",
	},
	{
		id: "pick",
		url: `${champSelect}/sfx-cs-draft-left-pick-single.ogg`,
		size: 51_304,
		sha256: "82f000bce2180abfd9882059580fba7ffe6cf70de9387e489bba9dd7e3c5ad64",
	},
	{
		id: "lock",
		url: `${champSelect}/sfx-cs-lockin-button-click.ogg`,
		size: 40_371,
		sha256: "916fc03e08f160435a5892cc1a087edd81ed2d6d16b4186b14013ef16f7d448a",
	},
	{
		id: "ban",
		url: `${champSelect}/sfx-cs-draft-ban-your-team.ogg`,
		size: 73_641,
		sha256: "3e0ea8c524c52f9f5f9a72a032ca616f09b87ce91242d40a8fb130429d43720b",
	},
	{
		id: "click",
		url: `${champSelect}/sfx-uikit-generic-click-small.ogg`,
		size: 10_415,
		sha256: "a8fe953c1944e0ca0b81f19a714c23502d76fd0c6e60e38fa8fa209a85af2c82",
	},
	{
		id: "swap",
		url: `${champSelect}/sfx-cs-notif-traderequest-accepted.ogg`,
		size: 52_815,
		sha256: "1bc989a2f8a1bfc9f109f6015cdd46aca04907543ff3fee7e61871fbc832a052",
	},
	{
		id: "tick",
		url: `${champSelect}/sfx-cs-timer-tick.ogg`,
		size: 36_044,
		sha256: "e61a579a6b5a695d8220c4e556ac1a4ccea00f6fca1c9c3b4e600e2bb6dfa82d",
	},
];

const oggSignature = Buffer.from("OggS");

/** The exact pinned bytes of an Ogg file, nothing else. */
const verifies = (source: SoundSource, bytes: Buffer) =>
	bytes.length === source.size &&
	bytes.subarray(0, oggSignature.length).equals(oggSignature) &&
	createHash("sha256").update(bytes).digest("hex") === source.sha256;

/** Only HTTPS Ogg files on CommunityDragon, with a sane size and digest. */
function soundFile(source: SoundSource): AssetFile | undefined {
	let url: URL;
	try {
		url = new URL(source.url);
	} catch {
		return undefined;
	}
	if (
		url.origin !== origin ||
		url.username ||
		url.password ||
		url.search ||
		!url.pathname.endsWith(".ogg") ||
		!/^[0-9a-f]{64}$/.test(source.sha256) ||
		!Number.isSafeInteger(source.size) ||
		source.size < 1 ||
		source.size > maxSoundBytes
	)
		return undefined;
	return {
		path: `draft/${source.id}.ogg`,
		url,
		limit: source.size,
		check: (bytes) => verifies(source, bytes),
	};
}

async function readSound(root: string, source: SoundSource) {
	const file = soundFile(source);
	if (!file) return undefined;
	const bytes = await readBytes(await cachePath(root, file.path), file.limit);
	return bytes && verifies(source, bytes) ? bytes : undefined;
}

/** Downloads the sounds missing on disk; failures are per sound. */
export async function syncSounds(
	root: string,
	sources: readonly SoundSource[],
	transport: AssetTransport,
	/** Called with the sounds finished so far out of those missing at the start. */
	progress?: (completed: number, total: number) => void,
): Promise<{ failed: SoundId[] }> {
	const failed: SoundId[] = [];
	const present = await readSounds(root, sources);
	const total = sources.filter(({ id }) => !present[id]).length;
	let completed = 0;
	progress?.(completed, total);
	for (const source of sources) {
		const file = soundFile(source);
		if (!file) {
			failed.push(source.id);
			continue;
		}
		if (present[source.id]) continue;
		try {
			const destination = await cachePath(root, file.path, true);
			for (const stale of [
				destination,
				`${destination}.part`,
				`${destination}.part.json`,
			])
				await rm(stale, { force: true });
			await downloadFile(root, file, transport);
			progress?.(++completed, total);
		} catch (error) {
			if (error instanceof NetworkUnavailable) break;
			failed.push(source.id);
		}
	}
	return { failed };
}

/** The verified sounds on disk, by id; the renderer synthesizes the rest. */
export async function readSounds(
	root: string,
	sources: readonly SoundSource[],
): Promise<CachedSounds> {
	const sounds: CachedSounds = {};
	for (const source of sources) {
		const bytes = await readSound(root, source).catch(() => undefined);
		if (bytes) sounds[source.id] = new Uint8Array(bytes);
	}
	return sounds;
}
