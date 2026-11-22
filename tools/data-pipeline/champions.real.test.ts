import { readFileSync } from "node:fs";
import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";

const read = (file: string) =>
	JSON.parse(
		readFileSync(
			new URL(
				`../../packages/core/content/real/champions/${file}.json`,
				import.meta.url,
			),
			"utf8",
		),
	);

it("the committed real champion files satisfy the core content contracts", () => {
	const champions = read("champions");
	const matchups = read("matchups");
	const synergies = read("synergies");
	expect(
		aiContent.safeParse({
			champions: champions.map(
				({
					cc: _cc,
					mobility: _mobility,
					frontline: _frontline,
					...rest
				}: Record<string, unknown>) => rest,
			),
			matchups,
			synergies,
			players: [],
			identities: [],
		}).error,
	).toBeUndefined();
	expect(
		matchContent.shape.champions.safeParse(
			champions.map(
				({ id, cc, mobility, frontline }: Record<string, unknown>) => ({
					id,
					cc,
					mobility,
					frontline,
				}),
			),
		).error,
	).toBeUndefined();
	expect(read("provenance").catalog.champions).toBe(champions.length);
});
