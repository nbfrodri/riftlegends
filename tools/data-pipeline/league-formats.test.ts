import { readFileSync } from "node:fs";
import { validateFormat } from "@rift-legends/contracts";
import {
	type Competition,
	competitionSchema,
} from "@rift-legends/contracts/competition-format";
import { describe, expect, it } from "vitest";
import { buildCalendar } from "../../packages/core/competition/calendar";
import { buildStageGraph } from "../../packages/core/competition/stage-graph";

const content = new URL("../../packages/core/content/real/", import.meta.url);
const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"] as const;
const internationals = ["first-stand", "msi", "worlds"];

function read(file: string) {
	return readFileSync(new URL(file, content), "utf8");
}

function readFormat(id: string) {
	return JSON.parse(read(`formats/${id.toLowerCase()}.json`));
}

function roster() {
	const teams: { id: string; league: string; seed: number }[] = JSON.parse(
		read("teams.json"),
	);
	return teams.map(({ id, league, seed }) => ({
		id,
		competition: league,
		region: league,
		rank: seed,
	}));
}

describe("2026 domestic formats", () => {
	it.each(leagues)(
		"V1 %s is a valid generated format with attribution and provisional rules",
		(id) => {
			const format = readFormat(id);
			expect(validateFormat(format)).toMatchObject({ ok: true });
			expect(format).toMatchObject({
				id,
				kind: "league",
				verified: false,
				tiebreakerBestOf: 3,
				provenance: { source: "Leaguepedia", licence: "CC BY-SA 3.0" },
			});
			expect(format.unverifiedReasons.join(" ")).toMatch(/tiebreak/i);
		},
	);

	it("T1 LCK keeps its rulebook order, but the tiebreaker series stays Bo3 by user decision", () => {
		expect(readFormat("LCK")).toMatchObject({
			tiebreak: ["seriesWins", "gameDiff", "headToHead", "tiebreakerSeries"],
			tiebreakerBestOf: 3,
		});
		const reasons: string[] = readFormat("LCK").unverifiedReasons;
		expect(reasons.join(" ")).toContain("2025 LCK rulebook");
	});

	it.each(leagues)(
		"R1 %s matches the snapshot, accounting for documented adaptations",
		async (id) => {
			const format = competitionSchema.parse(readFormat(id));
			const { buildLeagueFormats } = await import("./league-formats.ts");
			const { checkLeagueFormat } = await import("./league-format-check.ts");
			const built = buildLeagueFormats();
			expect(checkLeagueFormat(id, format)).toEqual([]);
			expect(read(`formats/${id.toLowerCase()}.json`)).toBe(
				`${JSON.stringify(built[id], null, "\t")}\n`,
			);
		},
	);

	it.each(leagues)(
		"R3 %s uses the game's roster rather than split-only invites",
		(id) => {
			const format = competitionSchema.parse(readFormat(id));
			const teams = roster()
				.filter((team) => team.competition === id)
				.map(({ id }) => id)
				.sort();
			const rosterStages = format.stages.flatMap(({ entrants }) =>
				(Array.isArray(entrants) ? entrants : [entrants])
					.filter((source) => source.kind === "fixed")
					.flatMap(({ teams }) => teams),
			);
			expect([...new Set(rosterStages)].sort()).toEqual(teams);
			if (id === "LEC")
				expect(format.stages[0]?.play).toMatchObject({
					type: "roundRobin",
					size: 10,
					rounds: 1,
					bestOf: 1,
				});
		},
	);

	it("C3: every stage starts within a week of its real 2026 start", async () => {
		const formats: Competition[] = [...leagues, ...internationals].map((id) =>
			competitionSchema.parse(readFormat(id)),
		);
		const built = buildStageGraph(formats, roster());
		if (!built.ok) throw new Error(JSON.stringify(built.error));
		const calendar = buildCalendar(built.graph, { year: 2026, seed: 42 });
		if (!calendar.ok) throw new Error(JSON.stringify(calendar.error));
		const { leagueStageStarts } = await import("./league-format-check.ts");
		const occupied = new Map<string, number>();
		for (const { ref, series } of calendar.stages)
			for (const { day } of series) {
				const key = `${ref.competition}:${day}`;
				occupied.set(key, 1 + (occupied.get(key) ?? 0));
			}
		expect(Math.max(...occupied.values())).toBeLessThanOrEqual(4);
		for (const id of leagues) {
			const starts = leagueStageStarts(id);
			const stages = calendar.stages.filter(
				({ ref }) => ref.competition === id,
			);
			expect(stages).toHaveLength(starts.size);
			for (const { ref, series } of stages) {
				const first = Math.min(...series.map(({ day }) => day));
				const real = starts.get(ref.stage);
				expect(real, `${id}/${ref.stage}`).toBeDefined();
				expect(
					Math.abs(first - (real ?? Infinity)),
					`${id}/${ref.stage}`,
				).toBeLessThanOrEqual(7);
			}
		}
	});
});

describe("#535 real rules", () => {
	it("generates LEC with the documented order and a Bo3 at cuts", () => {
		const format = competitionSchema.parse(readFormat("LEC"));
		expect(format.tiebreak.join(",")).toBe(
			"seriesWins,headToHead,priorSplitRank,strengthOfVictory,victoryTime,tiebreakerSeries,draw",
		);
		expect(format.tiebreakerBestOf).toBe(3);
		expect(format.stages.find(({ id }) => id === "spring")).toHaveProperty(
			"tiebreakHistory",
			["versus"],
		);
		expect(format.stages.find(({ id }) => id === "summer")).toHaveProperty(
			"tiebreakHistory",
			["spring", "versus"],
		);
	});

	it("R1 catches replacing the snapshot's Bo5 Cup week with Bo3", async () => {
		const { checkLeagueFormat } = await import("./league-format-check.ts");
		const format = competitionSchema.parse(readFormat("LCK"));
		const cup = format.stages.find(({ id }) => id === "cup-groups");
		if (cup?.play.type !== "groups") throw new Error("Expected Cup groups");
		const play = cup.play as typeof cup.play & {
			finalRound?: { bestOf: 1 | 3 | 5; groupPoints: number; week: number };
		};
		expect(checkLeagueFormat("LCK", format)).toEqual([]);
		delete play.finalRound;
		expect(checkLeagueFormat("LCK", format)).toContain(
			"cup-groups: Week 3 best of or series count differs",
		);
	});
});
