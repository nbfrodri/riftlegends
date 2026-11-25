import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import { game, line, snapshot } from "./player-team-content.fixtures.ts";
import { closeRoleGaps, fillRoleGaps, roleGaps } from "./roster-gaps.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-gaps-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

const roles = ["top", "jungle", "mid", "bot", "support"] as const;
const player = (team: string, role: (typeof roles)[number]) => ({
	id: `${team}-${role}-real`,
	name: `${team} ${role}`,
	role,
	sub: false,
	team,
});

/** Alpha lost its support to another team after the last split. */
function source(): RealSnapshot {
	const base = snapshot([game(0, [line("Alpha-top-real")])]);
	return {
		...base,
		seasonPlayers: [
			...roles
				.filter((role) => role !== "support")
				.map((r) => player("Alpha", r)),
			...roles.map((r) => player("Beta", r)),
		],
	};
}

const current = (rows: Record<string, string>[]) =>
	rows.map((row) => ({ Link: row.Link ?? "", Team: "Alpha Esports", ...row }));

test("a team without a player in a role is reported", () => {
	expect(roleGaps(source())).toEqual([
		{ team: "Alpha", name: "Alpha Esports", role: "support" },
	]);
});

test("the gap is filled with a real player of the current roster, never a placeholder", () => {
	const [filled] = fillRoleGaps(
		[source()],
		current([
			{ Link: "Retired", Player: "Retired", Role: "Support", Retired: "1" },
			{ Link: "Coach", Player: "Coach", Role: "Coach" },
			{ Link: "Zed", Player: "Zed", Role: "Support" },
			{ Link: "Abe", Player: "Abe", Role: "Support" },
		]),
	);
	const added = filled?.seasonPlayers.filter(
		(row) => row.team === "Alpha" && row.role === "support",
	);
	expect(added).toEqual([
		{
			id: "Abe",
			name: "Abe",
			role: "support",
			sub: false,
			noGames: true,
			team: "Alpha",
		},
	]);
	expect(roleGaps(filled as RealSnapshot)).toEqual([]);
});

test("a player already on another team is not borrowed", () => {
	const taken = source();
	const [filled] = fillRoleGaps(
		[taken],
		current([
			{ Link: "Beta-support-real", Player: "Beta support", Role: "Support" },
			{ Link: "Free", Player: "Free", Role: "Support" },
		]),
	);
	expect(filled?.seasonPlayers.find((row) => row.id === "Free")?.team).toBe(
		"Alpha",
	);
});

test("with nobody to fill a role the pipeline fails and names the team", () => {
	expect(() => fillRoleGaps([source()], [])).toThrow(/support.*Alpha Esports/s);
});

test("closing the gaps queries the Players table once, only for teams with gaps", async () => {
	const urls: URL[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		urls.push(new URL(String(input)));
		return Response.json({
			cargoquery: [
				{
					title: {
						Link: "Real Support (Legal Name)",
						Player: "Real Support",
						Team: "Alpha Esports",
						Role: "Support",
					},
				},
			],
		});
	});
	const client = new Client({ cacheDir: dir, fetch, sleep: async () => {} });
	const [closed] = await closeRoleGaps(client, [source()]);
	expect(urls).toHaveLength(1);
	expect(urls[0]?.searchParams.get("tables")).toBe("Players");
	expect(urls[0]?.searchParams.get("where")).toContain("'Alpha Esports'");
	expect(urls[0]?.searchParams.get("where")).not.toContain("Beta Esports");
	expect(roleGaps(closed as RealSnapshot)).toEqual([]);
	expect(JSON.stringify(closed)).not.toContain("Legal Name");
	await closeRoleGaps(client, [closed as RealSnapshot]);
	expect(fetch).toHaveBeenCalledTimes(1);
});
