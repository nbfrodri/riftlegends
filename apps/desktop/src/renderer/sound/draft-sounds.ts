import type { DraftView } from "@rift-legends/contracts";
import type { SoundId } from "../../shared/sounds";

/**
 * The sounds of what changed between two views of the same game: a new ban
 * plays `ban`; the user's own new pick plays `lock` (confirmed) and anyone
 * else's plays `pick`. A first view or a new game plays nothing.
 */
export function draftSounds(
	previous: DraftView | null,
	next: DraftView,
	mine: string | null,
): SoundId[] {
	if (!previous || previous.game !== next.game) return [];
	const sounds = new Set<SoundId>();
	for (const side of ["blue", "red"] as const) {
		const before = previous[side];
		const after = next[side];
		if (after.bans.slice(before.bans.length).some((ban) => ban !== null))
			sounds.add("ban");
		if (after.picks.length > before.picks.length)
			sounds.add(after.team === mine ? "lock" : "pick");
	}
	// Bans come before picks in a draft, so play them in that order.
	return (["ban", "lock", "pick"] as const).filter((id) => sounds.has(id));
}
