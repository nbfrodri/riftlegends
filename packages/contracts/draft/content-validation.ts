import type { RefinementCtx } from "zod";

/** Report repeated keys at the later row, or at the field holding the key. */
export function checkDuplicates<T>(
	ctx: RefinementCtx,
	block: string,
	rows: readonly T[],
	keyOf: (row: T) => string | number,
	field?: string,
) {
	const seen = new Set<string | number>();
	rows.forEach((row, index) => {
		const key = keyOf(row);
		if (seen.has(key)) {
			ctx.addIssue({
				code: "custom",
				path: field ? [block, index, field] : [block, index],
				message: `Duplicate ${field ?? "entry"}: ${key}`,
			});
		}
		seen.add(key);
	});
}

export function checkChampionReference(
	ctx: RefinementCtx,
	champions: ReadonlySet<string>,
	champion: string,
	path: (string | number)[],
) {
	if (!champions.has(champion)) {
		ctx.addIssue({
			code: "custom",
			path,
			message: `Unknown champion: ${champion}`,
		});
	}
}
