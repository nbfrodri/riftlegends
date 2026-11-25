import { isBirthDate } from "@rift-legends/contracts/age";
import type { CargoRow } from "./client.ts";
import { idResolver } from "./normalization.ts";
import { compare } from "./queries.ts";

const earliest = 1960;
const latest = 2020;

/**
 * A birth date from a Leaguepedia `Birthdate`: the full date, or just the year
 * when that is all there is. Leaguepedia stores a year-only date as 1 January,
 * so that day is published as the year alone. Impossible or implausible
 * values give nothing.
 */
export function parseBirthDate(value: string | null | undefined) {
	const text = value?.trim();
	if (!text || !isBirthDate(text)) return undefined;
	const year = Number(text.slice(0, 4));
	if (year < earliest || year > latest) return undefined;
	return text.endsWith("-01-01") ? text.slice(0, 4) : text;
}

/** One date per player of `ids`; a full date beats a year across rows. */
export function buildBirthDates(rows: readonly CargoRow[], ids: Iterable<string>) {
	const resolve = idResolver(ids);
	const found = new Map<string, string>();
	for (const row of rows) {
		const id = row.Link ? resolve(row.Link) : undefined;
		const birthDate = parseBirthDate(row.Birthdate);
		if (!id || !birthDate) continue;
		const previous = found.get(id);
		if (!previous || birthDate.length > previous.length)
			found.set(id, birthDate);
	}
	return [...found]
		.map(([id, birthDate]) => ({ id, birthDate }))
		.sort((a, b) => compare(a.id, b.id));
}
