import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import {
	type Game,
	game,
	line,
	snapshot,
} from "./player-team-content.fixtures.ts";
import { buildPlayerTeamContent } from "./player-team-content.ts";

function splits() {
	const source = snapshot([]);
	const played = (tournament: string, day: number, a: string, b: string) => ({
		...game(day, [line("Starter", { team: a })]),
		id: `${tournament}-${a}-${b}`,
		tournament,
		teams: [
			{ id: a, side: "blue" as const, picks: [], bans: [] },
			{ id: b, side: "red" as const, picks: [], bans: [] },
		] as Game["teams"],
	});
	return {
		...source,
		tournaments: [
			{ id: "spring", name: "Spring", startsOn: "2026-02-01" },
			{ id: "summer", name: "Summer", startsOn: "2026-07-01" },
			{ id: "summer-po", name: "Summer Playoffs", startsOn: "2026-09-01" },
		],
		teams: ["Alpha", "Beta", "Guest"].map((id) => ({
			id,
			name: id,
			league: "LCK",
		})),
		rosters: [],
		seasonPlayers: [
			{
				id: "Starter",
				name: "Starter",
				team: "Alpha",
				role: "bot" as const,
				sub: false,
			},
			{
				id: "Visitor",
				name: "Visitor",
				team: "Guest",
				role: "top" as const,
				sub: false,
			},
		],
		games: [
			played("spring", 1, "Alpha", "Guest"),
			played("spring", 2, "Alpha", "Beta"),
			played("summer", 3, "Alpha", "Beta"),
			played("summer-po", 4, "Alpha", "Beta"),
		],
	} satisfies RealSnapshot;
}

test("league teams played the latest split or most splits; guests stay out with their players", () => {
	const { teams, players } = buildPlayerTeamContent([splits()]);
	expect(teams.map((t) => t.id).sort()).toEqual(["Alpha", "Beta"]);
	expect(players.some((p) => p.team === "Guest")).toBe(false);
	expect(players.some((p) => p.id === "Visitor")).toBe(false);
});

test("league member exceptions can add or drop a team", () => {
	const ids = (exceptions: Parameters<typeof buildPlayerTeamContent>[3]) =>
		buildPlayerTeamContent([splits()], new Map(), new Map(), exceptions)
			.teams.map((t) => t.id)
			.sort();
	expect(ids({ include: { LCK: ["Guest"] }, exclude: {} })).toEqual([
		"Alpha",
		"Beta",
		"Guest",
	]);
	expect(ids({ include: {}, exclude: { LCK: ["Beta"] } })).toEqual(["Alpha"]);
});

test("a team that played most splits but not the last one stays (LPL franchises)", () => {
	const base = splits();
	const [template] = base.games;
	if (!template) throw new Error("fixture");
	const played = (tournament: string, a: string, b: string) => ({
		...template,
		id: `${tournament}-${a}-${b}`,
		tournament,
		teams: [
			{ id: a, side: "blue" as const, picks: [], bans: [] },
			{ id: b, side: "red" as const, picks: [], bans: [] },
		] as Game["teams"],
	});
	const source = {
		...base,
		tournaments: [
			{ id: "s1", name: "Split 1", startsOn: "2026-01-01" },
			{ id: "s2", name: "Split 2", startsOn: "2026-04-01" },
			{ id: "s3", name: "Split 3", startsOn: "2026-07-01" },
			{ id: "s3-po", name: "Split 3 Playoffs", startsOn: "2026-09-01" },
		],
		games: [
			played("s1", "Alpha", "Beta"),
			played("s1", "Alpha", "Guest"),
			played("s2", "Alpha", "Beta"),
			played("s2", "Alpha", "Guest"),
			played("s3", "Alpha", "Beta"),
		],
	};
	const { teams } = buildPlayerTeamContent([source]);
	expect(teams.map((t) => t.id).sort()).toEqual(["Alpha", "Beta", "Guest"]);
});
