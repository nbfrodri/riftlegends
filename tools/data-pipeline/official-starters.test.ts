import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Client } from "./client.ts";
import { parseApiTeams } from "./logos.ts";
import {
	officialStarters,
	preferOfficialStarters,
} from "./official-starters.ts";
import { game, line, snapshot } from "./player-team-content.fixtures.ts";
import { closeRoleGaps, fillRoleGaps, roleGaps } from "./roster-gaps.ts";

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "rift-starters-"));
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

/** getTeams body: Alpha Esports (AE) of the LCK with the given players. */
const api = (players: [handle: string, role: string][]) =>
	parseApiTeams({
		data: {
			teams: [
				{
					slug: "alpha",
					name: "Alpha Esports",
					code: "AE",
					image: null,
					status: "active",
					homeLeague: { name: "LCK" },
					players: players.map(([summonerName, role]) => ({
						summonerName,
						role,
					})),
				},
			],
		},
	});

const roles = ["top", "jungle", "mid", "bot", "support"] as const;
const player = (team: string, role: (typeof roles)[number]) => ({
	id: `${team}-${role}-real`,
	name: `${team} ${role}`,
	role,
	sub: false,
	team,
});

/** Alpha lost its support after the last split. */
function gapped(): RealSnapshot {
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

const rows = (list: [link: string, role: string, team?: string][]) =>
	list.map(([Link, Role, Team]) => ({
		Link,
		Player: Link,
		Role,
		Team: Team ?? "Alpha Esports",
		Retired: "0",
	}));

test("lolesports roles map to positions and keep their listed order", () => {
	const official = officialStarters(
		api([
			["Zed", "support"],
			["Abe", "bottom"],
			["Cy", "none"],
		]),
	);
	const alpha = {
		id: "Alpha",
		name: "Alpha Esports",
		short: "AE",
		league: "LCK",
	};
	expect(official(alpha, "support")).toEqual(["Zed"]);
	expect(official(alpha, "bot")).toEqual(["Abe"]);
	expect(official(alpha, "top")).toEqual([]);
	expect(official({ ...alpha, league: "LEC" }, "support")).toEqual([]);
});

test("a gap Leaguepedia's roster cannot fill is covered by the official starter, found by handle", () => {
	const official = officialStarters(api([["Kuri", "support"]]));
	const [filled] = fillRoleGaps(
		[gapped()],
		[
			...rows([["Retired", "Support"]]).map((r) => ({ ...r, Retired: "1" })),
			// The official starter's page lists another team: still the starter.
			...rows([["Kuri", "Support", "Old Team"]]),
		],
		undefined,
		official,
	);
	expect(
		filled?.seasonPlayers.find(
			(p) => p.team === "Alpha" && p.role === "support",
		)?.id,
	).toBe("Kuri");
	expect(roleGaps(filled as RealSnapshot)).toEqual([]);
});

test("an official starter already on another team is not borrowed", () => {
	const official = officialStarters(api([["Beta support", "support"]]));
	expect(() =>
		fillRoleGaps(
			[gapped()],
			rows([["Beta-support-real", "Support", "Beta Esports"]]),
			undefined,
			official,
		),
	).toThrow(/support.*Alpha Esports/s);
});

test("among several roster candidates for a gap the official starter wins over the first by id", () => {
	const official = officialStarters(api([["Zed", "support"]]));
	const [filled] = fillRoleGaps(
		[gapped()],
		rows([
			["Abe", "Support"],
			["Zed", "Support"],
		]),
		undefined,
		official,
	);
	expect(
		filled?.seasonPlayers.find((p) => p.noGames && p.team === "Alpha")?.id,
	).toBe("Zed");
});

test("with the roster candidate absent from lolesports the first by id still fills the gap", () => {
	const [filled] = fillRoleGaps(
		[gapped()],
		rows([
			["Zed", "Support"],
			["Abe", "Support"],
		]),
		undefined,
		officialStarters(api([])),
	);
	expect(
		filled?.seasonPlayers.find((p) => p.noGames && p.team === "Alpha")?.id,
	).toBe("Abe");
});

test("with neither lolesports nor Leaguepedia the pipeline fails naming team and role", () => {
	expect(() =>
		fillRoleGaps([gapped()], [], undefined, officialStarters(api([]))),
	).toThrow(/No real support found for Alpha Esports \(LCK\)/);
});

const botsOf = (source: RealSnapshot) =>
	Object.fromEntries(
		source.seasonPlayers
			.filter((p) => p.team === "Alpha" && p.role === "bot")
			.map((p) => [p.id, p.sub]),
	);

test("tiebreak: among several candidates the one lolesports lists as starter wins", () => {
	const source = snapshot([game(0, [line("Starter")])]);
	expect(botsOf(source)).toEqual({
		Starter: false,
		Brief: true,
		Reserve: true,
	});
	const [result] = preferOfficialStarters(
		[source],
		api([
			["Brief", "bottom"],
			["Starter", "bottom"],
		]),
	);
	expect(botsOf(result as RealSnapshot)).toEqual({
		Starter: true,
		Brief: false,
		Reserve: true,
	});
});

test("tiebreak leaves the snapshot alone when the official starter already leads, is unknown or ambiguous", () => {
	const source = snapshot([game(0, [line("Starter")])]);
	for (const players of [
		[["Starter", "bottom"]],
		[["Nobody", "bottom"]],
		[],
	] as [string, string][][]) {
		const [result] = preferOfficialStarters([source], api(players));
		expect(result).toEqual(source);
	}
	const twins = {
		...source,
		seasonPlayers: [
			...source.seasonPlayers,
			{
				id: "Brief~2",
				name: "brief",
				team: "Alpha",
				role: "bot" as const,
				sub: true,
			},
		],
	};
	const [result] = preferOfficialStarters([twins], api([["Brief", "bottom"]]));
	expect(result).toEqual(twins);
});

test("closing the gaps looks the official starters up by handle, in one extra query", async () => {
	const urls: URL[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
		const url = new URL(String(input));
		urls.push(url);
		return Response.json({
			cargoquery: url.searchParams.get("where")?.startsWith("ID IN")
				? [
						{
							title: {
								Link: "Kuri",
								Player: "Kuri",
								Team: "Old Team",
								Role: "Support",
							},
						},
					]
				: [],
		});
	});
	const client = new Client({ cacheDir: dir, fetch, sleep: async () => {} });
	const [closed] = await closeRoleGaps(
		client,
		[gapped()],
		undefined,
		officialStarters(api([["Kuri", "support"]])),
	);
	expect(urls.map((u) => u.searchParams.get("where")?.split(" ")[0])).toEqual([
		"Team",
		"ID",
	]);
	expect(roleGaps(closed as RealSnapshot)).toEqual([]);
});
