import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import { expect, it } from "vitest";
import { summarize } from "./summary.ts";

type League = Pick<
	RealSnapshot,
	"league" | "teams" | "seasonPlayers" | "games"
>;

function league(
	id: string,
	teams: string[],
	playerTeam: string,
	champion: string,
): League {
	const [blue = "Blue", red = "Red"] = teams;
	return {
		league: { id, name: id },
		teams: teams.map((name) => ({ id: name, name, league: id })),
		seasonPlayers: playerTeam
			? [{ id: "player", name: "PublicHandle", team: playerTeam, sub: false }]
			: [],
		games: [
			{
				id: "game",
				tournament: "split",
				date: "2026-11-22T12:00:00Z",
				draftOrder: true,
				teams: [
					{ id: blue, side: "blue", picks: [null, "Ahri"], bans: [champion] },
					{ id: red, side: "red", picks: ["Ahri"], bans: [null] },
				],
				lines: [{ player: "player", team: blue, champion: "Jinx" }],
			},
		],
	};
}

it("P5 summarizes cross-league transfers, new teams, new champions and game totals", () => {
	const before = [league("LCK", ["Blue", "Red"], "Blue", "Bard")];
	const after = [
		league("LEC", ["New | Team", "Red"], "New | Team", "Varus"),
		league("LCK", ["Blue", "Red"], "", "Varus"),
	];

	const summary = summarize(before, after);
	expect(summary).toContain("Fichajes (1)");
	expect(summary).toContain("PublicHandle");
	expect(summary).toContain("Blue (LCK)");
	expect(summary).toContain("Equipos nuevos (1)");
	expect(summary).toContain("New \\| Team (LEC)");
	expect(summary).toContain("Campeones nuevos en partidas (1)");
	expect(summary).toContain("Varus");
	expect(summary).toContain("| LEC | 0 | 1 |");
});

it("P5 omits transfers for new players and returns stable counts for unchanged leagues", () => {
	const before = [league("LCK", ["Blue", "Red"], "", "Bard")];
	const after = [league("LCK", ["Blue", "Red"], "Blue", "Bard")];

	expect(summarize(before, after)).toContain("Fichajes (0)");
	expect(summarize(before, after)).toContain("| LCK | 1 | 1 |");
});

it("summarizes a season change from a legacy snapshot", () => {
	const before = league("LCK", ["Blue", "Red"], "Blue", "Bard");
	const after = {
		...league("LCK", ["New", "Blue"], "Blue", "Bard"),
		season: 2027,
	};
	expect(summarize([before], [after])).toContain(
		"Cambio de temporada de 2026 a 2027",
	);
});
