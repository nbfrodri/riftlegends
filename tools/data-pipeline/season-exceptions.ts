/**
 * Pages the automatic discovery (`season.ts`) gets wrong, by league id.
 * `exclude` drops a page it would take; `include` adds one it would skip
 * (for example a tournament Leaguepedia files without a `League`). Add a
 * comment with the reason for each entry. Empty today.
 */
export interface SeasonExceptions {
	exclude: Readonly<Record<string, readonly string[]>>;
	include: Readonly<Record<string, readonly string[]>>;
}

export const seasonExceptions: SeasonExceptions = { exclude: {}, include: {} };
