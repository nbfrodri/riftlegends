import { createHash } from "node:crypto";
import type { CargoRow } from "./client.ts";
import { compare, type SourceData, teamKey } from "./queries.ts";

export function field(row: CargoRow, name: string): string | undefined {
	return row[name]?.trim() || undefined;
}

export function required(row: CargoRow, name: string): string {
	const value = field(row, name);
	if (!value)
		throw new Error(
			`Missing ${name} in ${row.GameId ?? row.OverviewPage ?? "Cargo row"}`,
		);
	return value;
}

export function orderBy<T>(rows: readonly T[], key: (row: T) => string): T[] {
	return [...rows].sort((a, b) => compare(key(a), key(b)));
}

export function indexBy<T>(
	rows: readonly T[],
	key: (row: T) => string,
	label: string,
): Map<string, T> {
	const result = new Map<string, T>();
	for (const row of rows) {
		const id = key(row);
		if (result.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
		result.set(id, row);
	}
	return result;
}

export function groupBy<T>(
	rows: Iterable<T>,
	key: (row: T) => string,
): Map<string, T[]> {
	const result = new Map<string, T[]>();
	for (const row of rows) {
		const id = key(row);
		const group = result.get(id);
		if (group) group.push(row);
		else result.set(id, [row]);
	}
	return result;
}

export function key(...parts: string[]): string {
	return JSON.stringify(parts);
}

const roles = new Map([
	["top", "top"],
	["jungle", "jungle"],
	["mid", "mid"],
	["bot", "bot"],
	["adc", "bot"],
	["support", "support"],
] as const);

export function roleOf(name: string | undefined) {
	return roles.get(name?.toLowerCase() as Parameters<typeof roles.get>[0]);
}

export function person(link: string, display?: string) {
	const handle = (value: string) => value.replace(/\s+\([^()]+\)$/, "");
	const bare = handle(link);
	// Disambiguators in wiki links can contain legal names. Keep the public
	// handle and an opaque fingerprint of the full link for identity joins.
	const id =
		bare === link
			? link
			: `${bare}~${createHash("sha256").update(link).digest("hex").slice(0, 16)}`;
	return { id, name: handle(display ?? bare) };
}

/** Maps a Leaguepedia link to a snapshot player id (exact, then ignoring case). */
export function idResolver(ids: Iterable<string>) {
	const exact = new Set(ids);
	const folded = new Map<string, string | null>();
	for (const id of exact) {
		const key = id.toLowerCase();
		folded.set(key, folded.has(key) ? null : id);
	}
	return (link: string) => {
		const { id } = person(link);
		return exact.has(id) ? id : (folded.get(id.toLowerCase()) ?? undefined);
	};
}

export function teamResolver(source: SourceData) {
	const pages = indexBy(
		source.teams,
		(row) => required(row, "OverviewPage"),
		"team page",
	);
	const names = new Map<string, Set<string>>();
	function add(name: string, id: string) {
		const lookup = teamKey(name);
		const ids = names.get(lookup) ?? new Set<string>();
		ids.add(id);
		names.set(lookup, ids);
	}
	for (const [id, row] of pages) {
		add(id, id);
		add(required(row, "Name"), id);
	}
	for (const row of source.redirects) {
		const target = field(row, "OtherName");
		const candidates = target ? names.get(teamKey(target)) : undefined;
		if (candidates?.size === 1) {
			for (const id of candidates) add(required(row, "AllName"), id);
		}
	}
	const historical = new Map<string, string>();
	for (const row of orderBy(source.renames, (row) =>
		key(row.Date ?? "", row.OriginalName ?? "", row.NewName ?? ""),
	)) {
		if (field(row, "IsSamePage") !== "Yes") continue;
		const candidates = names.get(teamKey(required(row, "NewName")));
		if (candidates?.size === 1) {
			for (const id of candidates)
				historical.set(teamKey(required(row, "OriginalName")), id);
		}
	}
	return {
		pages,
		resolve(name: string): string {
			if (pages.has(name)) return name;
			const candidates = names.get(teamKey(name));
			if (candidates?.size === 1) return [...candidates][0] as string;
			const previous = historical.get(teamKey(name));
			if (!candidates && previous) return previous;
			throw new Error(
				`Unresolved team: ${name}${candidates ? ` (${[...candidates].sort(compare).join(", ")})` : ""}`,
			);
		},
	};
}

const championAliases = new Map([
	["Wukong", "MonkeyKing"],
	["Nunu & Willump", "Nunu"],
	["Nunu", "Nunu"],
]);

export function championResolver(source: SourceData) {
	const byName = new Map(source.champions.map(({ id, name }) => [name, id]));
	const ids = new Set(source.champions.map(({ id }) => id));
	const missing = new Set<string>();
	return {
		find(value: string | undefined): string | undefined {
			if (!value) return;
			const id = championAliases.get(value) ?? byName.get(value);
			if (id && ids.has(id)) return id;
			missing.add(value);
		},
		check() {
			if (missing.size)
				throw new Error(
					`Unmapped champions: ${[...missing].sort(compare).join(", ")}`,
				);
		},
	};
}

export type ResolveTeam = ReturnType<typeof teamResolver>["resolve"];
export type ResolveChampion = ReturnType<typeof championResolver>["find"];
