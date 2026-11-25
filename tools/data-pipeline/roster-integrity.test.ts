import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import { leagues } from "./scope.ts";

const dir = fileURLToPath(
	new URL("../../packages/core/content/real/", import.meta.url),
);
const read = async (file: string) =>
	JSON.parse(await readFile(`${dir}${file}`, "utf8"));

interface Player {
	id: string;
	team: string;
	role: string;
	handle: string;
	sub?: boolean;
	placeholder?: true;
	nationality?: string;
}
const roles = ["top", "jungle", "mid", "bot", "support"];

/** Players whose Leaguepedia page has no country. Each needs a reason. */
const withoutNationality: Record<string, string> = {};

test("no published player is invented: every one comes from a Leaguepedia page", async () => {
	const players: Player[] = await read("players.json");
	const snapshots = await Promise.all(
		leagues.map(async ({ id }) =>
			realSnapshotSchema.parse(await read(`${id.toLowerCase()}.json`)),
		),
	);
	const known = new Set(
		snapshots.flatMap((snapshot) => [
			...snapshot.seasonPlayers.map(({ id }) => id),
			...snapshot.rosters.flatMap((roster) =>
				roster.players.map(({ id }) => id),
			),
		]),
	);
	expect(players.filter((p) => p.placeholder).map((p) => p.id)).toEqual([]);
	expect(players.filter((p) => !known.has(p.id)).map((p) => p.id)).toEqual([]);
});

test("every team has a real starter in each of the five roles", async () => {
	const players: Player[] = await read("players.json");
	const teams: { id: string }[] = await read("teams.json");
	const missing = teams.flatMap(({ id }) =>
		roles
			.filter((role) => !players.some((p) => p.team === id && p.role === role))
			.map((role) => `${id} ${role}`),
	);
	expect(missing).toEqual([]);
});

test("every player has a nationality or a listed reason", async () => {
	const players: Player[] = await read("players.json");
	const lacking = players
		.filter((p) => !p.nationality && !(p.id in withoutNationality))
		.map((p) => p.id);
	expect(lacking).toEqual([]);
	const stale = Object.keys(withoutNationality).filter((id) =>
		players.some((p) => p.id === id && p.nationality),
	);
	expect(stale).toEqual([]);
});

test("a person is one player: no two jungle ids of a team are aliases of each other", async () => {
	const players: Player[] = await read("players.json");
	const fsh = players.filter(
		(p) => p.team === "Fukuoka SoftBank HAWKS gaming" && p.role === "jungle",
	);
	// `Van (Kim Seung-hoo)` is a redirect to `Van1`: one person.
	expect(fsh.map((p) => p.id)).toEqual(["Van1"]);
});
