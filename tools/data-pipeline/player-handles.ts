import { groupBy } from "./normalization.ts";
import { compare } from "./queries.ts";

/** Keeps what the handle schema allows; at most 24 characters. */
export const nick = (text: string) =>
	text
		.replace(/[^\p{L}\p{N} ._-]/gu, "")
		.trim()
		.slice(0, 24)
		.trim() || "Player";

/**
 * Handles are unique without regard to case. Players who share one get their
 * team (and, if still equal, their role) appended, so the result does not
 * depend on input order.
 */
export function uniqueHandles<
	T extends { handle: string; team: string; role: string; id: string },
>(rows: T[], teamNames: ReadonlyMap<string, string>): T[] {
	const groups = groupBy(rows, (row) => row.handle.toLowerCase());
	const taken = new Set(
		[...groups].filter(([, group]) => group.length === 1).map(([name]) => name),
	);
	const renamed = new Map<string, string>();
	for (const group of groups.values()) {
		if (group.length === 1) continue;
		for (const row of group) {
			const team = nick(teamNames.get(row.team) ?? row.team);
			let handle = `${nick(row.handle).slice(0, 24 - team.length - 1)}.${team}`;
			const same = group
				.filter((other) => other.team === row.team)
				.sort((a, b) => compare(a.id, b.id));
			if (same.length > 1)
				handle = `${handle.slice(0, 24 - row.role.length - 1)}.${row.role}`;
			const twins = same.filter((other) => other.role === row.role);
			if (twins.length > 1)
				handle = `${handle.slice(0, 20)}.${twins.indexOf(row) + 1}`;
			renamed.set(row.id, handle);
		}
	}
	const seen = new Set(taken);
	for (const handle of renamed.values()) {
		if (seen.has(handle.toLowerCase()))
			throw new Error(`Cannot make the handle unique: ${handle}`);
		seen.add(handle.toLowerCase());
	}
	return rows.map((row) => ({
		...row,
		handle: renamed.get(row.id) ?? row.handle,
	}));
}
