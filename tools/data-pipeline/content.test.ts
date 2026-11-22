import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { buildContent } from "./content.ts";

const dir = fileURLToPath(
	new URL("../../packages/core/content/real/", import.meta.url),
);
const read = async (file: string) =>
	JSON.parse(await readFile(`${dir}${file}`, "utf8"));

test("the committed players and teams are what the snapshot produces", async () => {
	for (const [file, body] of Object.entries(await buildContent()))
		expect(body, file).toBe(await readFile(`${dir}${file}`, "utf8"));
});

test("real players and teams have the shape of the fictional content", async () => {
	const players: Record<string, unknown>[] = await read("players.json");
	const teams: { id: string; seed: number }[] = await read("teams.json");
	const draft = aiContent.shape.players.element;
	const match = matchContent.shape.players.element;
	for (const player of players) {
		const { attributes, leader, mastery, ...rest } = player;
		expect(draft.safeParse(rest).success, JSON.stringify(rest)).toBe(true);
		expect(
			match.safeParse({
				id: (rest as { id: string }).id,
				attributes,
				leader,
				mastery,
			}).success,
		).toBe(true);
	}
	for (const team of teams)
		expect(
			matchContent.shape.teams.element.safeParse(team).success,
			team.id,
		).toBe(true);
	expect(new Set(teams.map((team) => team.seed)).size).toBe(teams.length);
	for (const { id } of teams) {
		const roster = players.filter((p) => p.team === id);
		expect(new Set(roster.map((p) => p.role))).toEqual(
			new Set(["top", "jungle", "mid", "bot", "support"]),
		);
		expect(roster.filter((p) => p.leader)).toHaveLength(1);
	}
});
