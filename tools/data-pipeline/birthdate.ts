import { readFile } from "node:fs/promises";
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
export function buildBirthDates(
	rows: readonly CargoRow[],
	ids: Iterable<string>,
) {
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

export interface BirthDatesFile {
	provenance: {
		source: string;
		domain: string;
		retrievedAt: string;
		licence: string;
		attribution: string;
		queries: { url: string; retrievedAt: string }[];
	};
	players: { id: string; birthDate: string }[];
}

export function serializeBirthDates(file: BirthDatesFile) {
	const rows = file.players.map((row) => `\t\t${JSON.stringify(row)}`);
	return `{\n\t"provenance": ${JSON.stringify(file.provenance)},\n\t"players": ${rows.length ? `[\n${rows.join(",\n")}\n\t]` : "[]"}\n}\n`;
}

/** Reads birthdates.json; throws on a malformed file. */
export function parseBirthDates(text: string): BirthDatesFile {
	const body = JSON.parse(text) as BirthDatesFile;
	if (!body || typeof body !== "object" || !Array.isArray(body.players))
		throw new Error("Invalid birth dates file");
	for (const { id, birthDate } of body.players)
		if (typeof id !== "string" || !isBirthDate(birthDate))
			throw new Error(`Invalid birth date for ${id}`);
	return body;
}

const withoutDates = (file: BirthDatesFile) =>
	JSON.stringify({
		...file,
		provenance: {
			...file.provenance,
			retrievedAt: undefined,
			queries: file.provenance.queries.map(({ url }) => url),
		},
	});

/** Keeps the published bytes when only retrieval dates changed. */
export async function preserveBirthDates(path: string, file: BirthDatesFile) {
	try {
		const existing = await readFile(path, "utf8");
		if (withoutDates(parseBirthDates(existing)) === withoutDates(file))
			return existing;
	} catch {
		// Missing or unreadable: write the new one.
	}
	return serializeBirthDates(file);
}
