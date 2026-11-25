import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const real = new URL("../../packages/core/content/real/", import.meta.url);
const read = (name: string) =>
	JSON.parse(readFileSync(new URL(name, real), "utf8"));

test("the leagues snapshot has a logo for every game league and international", () => {
	const ids = new Set(read("leagues.json").leagues.map((l: { id: string }) => l.id));
	for (const id of ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"])
		expect(ids, id).toContain(id);
	for (const id of ["First Stand", "MSI", "Worlds"])
		expect(ids, id).toContain(id);
});
