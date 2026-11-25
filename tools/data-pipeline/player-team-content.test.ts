import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import {
	game,
	line,
	logo,
	profile,
	snapshot,
} from "./player-team-content.fixtures.ts";
import { buildPlayerTeamContent } from "./player-team-content.ts";

const season = () =>
	Array.from({ length: 24 }, (_, i) =>
		game(i, [
			line("Starter", {
				cs: 340,
				visionScore: 30,
				champion: i < 16 ? "Draven" : "Jinx",
			}),
			...(i === 0
				? [
						line("Brief", {
							team: "Beta",
							cs: 50,
							visionScore: 5,
							champion: "Kaisa",
						}),
					]
				: []),
			line("Top", { role: "top", cs: 500, champion: "Renekton" }),
		]),
	);

test("J1 and P4 rank by role, shrink small samples and flag estimates", () => {
	const source = snapshot(season());
	const starter = profile(source, "Starter");
	const brief = profile(source, "Brief");
	const reserve = profile(source, "Reserve");
	expect(Object.keys(starter.attributes)).toHaveLength(20);
	expect(reserve.estimated).toEqual(Object.keys(reserve.attributes));
	expect(starter.estimated).toContain("communication");
	expect(starter.estimated).not.toContain("farming");
	expect(starter.attributes.farming).toBeGreaterThan(
		reserve.attributes.farming,
	);
	expect(reserve.attributes.farming).toBeGreaterThan(brief.attributes.farming);
	expect(reserve.attributes.farming - brief.attributes.farming).toBeLessThan(
		starter.attributes.farming - reserve.attributes.farming,
	);
	expect(
		profile(
			snapshot(
				season().map((g) => ({
					...g,
					lines: g.lines.filter((l) => l.role !== "top"),
				})),
			),
			"Starter",
		).attributes.farming,
	).toBe(starter.attributes.farming);
});

test("J2 gives the same performance more weight in LCK and LPL than CBLOL", () => {
	const fromLeague = (league: string) =>
		profile(snapshot(season(), league), "Starter").level;
	expect(fromLeague("LCK")).toBeGreaterThanOrEqual(fromLeague("LPL"));
	expect(fromLeague("LPL")).toBeGreaterThan(fromLeague("LCS"));
	expect(fromLeague("LCS")).toBeGreaterThan(fromLeague("CBLOL"));
});

test("J3 keeps played champions ahead of role fillers and uses exposure for mastery", () => {
	const source = snapshot(season());
	const player = profile(source, "Starter");
	expect(player.mains).toEqual(["Draven", "Jinx"]);
	expect(player.weak).toEqual(["Kaisa"]);
	const mastery = new Map(
		player.mastery.map(({ champion, value }) => [champion, value]),
	);
	expect(mastery.get("Draven")).toBeGreaterThan(mastery.get("Jinx") ?? 100);
	expect(mastery.get("Jinx")).toBeGreaterThan(mastery.get("Kaisa") ?? 100);
});

test("J4 uses game results, chooses the head coach, copies logo and keeps real players in every role", () => {
	const content = buildPlayerTeamContent([
		snapshot([game(1, [line("Starter")], "Beta")]),
	]);
	expect(content.teams).toMatchObject([
		{ id: "Beta", seed: 1, coach: { name: "—", personality: "balanced" } },
		{
			id: "Alpha",
			name: "Alpha Esports",
			short: "AE",
			logo,
			seed: 2,
			coach: { name: "Head", personality: "balanced" },
		},
	]);
	expect(
		content.players
			.filter((p) => p.team === "Beta")
			.map((p) => p.role)
			.sort(),
	).toEqual(["bot", "jungle", "mid", "support", "top"]);
	expect(
		content.players.find((p) => p.team === "Beta")?.estimated,
	).toHaveLength(20);
	expect(
		content.players.filter((p) => p.team === "Alpha" && p.role === "bot").at(-1)
			?.id,
	).toBe("Starter");
});

test("J5 uses the early picks and the curve of the draft, with a minimum sample", () => {
	const source = snapshot(season().slice(0, 8));
	expect(
		buildPlayerTeamContent([source]).teams.find((t) => t.id === "Alpha")?.coach
			.personality,
	).toBe("early");
	const unordered = {
		...source,
		games: source.games.map((g) => ({ ...g, draftOrder: false })),
	};
	expect(
		buildPlayerTeamContent([unordered]).teams.find((t) => t.id === "Alpha")
			?.coach.personality,
	).toBe("balanced");
});

test("input row order does not change the serialized output", () => {
	const source = snapshot(season());
	expect(JSON.stringify(buildPlayerTeamContent([source]))).toBe(
		JSON.stringify(
			buildPlayerTeamContent([
				{
					...source,
					teams: [...source.teams].reverse(),
					seasonPlayers: [...source.seasonPlayers].reverse(),
					games: [...source.games]
						.reverse()
						.map((g) => ({ ...g, lines: [...g.lines].reverse() })),
				},
			]),
		),
	);
});

test("players who share a handle get their team appended, whatever the input order", () => {
	const source = snapshot(season());
	const twin = {
		...source,
		seasonPlayers: [
			...source.seasonPlayers,
			{
				id: "Starter (2)",
				name: "starter",
				team: "Beta",
				role: "top" as const,
				sub: false,
			},
		],
	};
	const handles = (s: RealSnapshot) =>
		buildPlayerTeamContent([s])
			.players.filter((p) => /starter/i.test(p.handle))
			.map((p) => p.handle);
	expect(handles(twin).sort()).toEqual(["Starter.AE", "starter.BE"]);
	expect(
		handles({
			...twin,
			seasonPlayers: [...twin.seasonPlayers].reverse(),
		}).sort(),
	).toEqual(["Starter.AE", "starter.BE"]);
	expect(profile(source, "Starter").handle).toBe("Starter");
});

test("a player has a nationality only when the data has one", () => {
	const source = snapshot([game(1, [line("Starter")])]);
	const nationalities = new Map([["Starter", "KR"]]);
	const { players } = buildPlayerTeamContent(
		[source],
		new Map(),
		nationalities,
	);
	expect(players.find((p) => p.id === "Starter")?.nationality).toBe("KR");
	const other = players.find((p) => p.id !== "Starter");
	expect(other && "nationality" in other).toBe(false);
	expect(
		buildPlayerTeamContent([source]).players.some((p) => "nationality" in p),
	).toBe(false);
});

test("a team without a player in some role is an error, never a placeholder", () => {
	const source = snapshot(season());
	source.seasonPlayers = source.seasonPlayers.filter(
		(row) => !(row.team === "Alpha" && row.role === "support"),
	);
	expect(() => buildPlayerTeamContent([source])).toThrow(/Alpha.*support/s);
});
