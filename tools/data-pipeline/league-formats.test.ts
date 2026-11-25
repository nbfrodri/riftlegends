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

	it("C3: the winter snapshot cannot fit all its starts within seven days at four series per day", async () => {
		const { leagueSource } = await import("./league-formats.ts");
		const openings = [
			["LCK", ["cup-groups"], "cup-playin-r1-1"],
			[
				"LPL",
				["split-1-high", "split-1-mid", "split-1-low"],
				"split-1-ladder-a",
			],
			["LEC", ["versus"], "versus-playoffs"],
			["LCP", ["split-1"], "split-1-playoffs"],
			["LCS", ["lock-in-swiss"], "lock-in-last-chance"],
			["CBLOL", ["cup"], "cup-playin-1"],
		] as const;
		let earliest = Infinity;
		let latest = 0;
		let demand = 0;
		for (const [id, stages, successor] of openings) {
			const { evidence, roster } = leagueSource(id);
			const series = stages
				.flatMap((stage) => evidence.get(stage) ?? [])
				.filter(({ teams }) => teams.every((team) => roster.includes(team)));
			demand += series.length;
			earliest = Math.min(earliest, ...series.map(({ day }) => day - 7));
			latest = Math.max(
				latest,
				Math.min(...(evidence.get(successor) ?? []).map(({ day }) => day + 7)),
			);
		}
		// All opening series must precede a successor. This capacity ignores
		// playoff series and clashes, so it is already an optimistic bound.
		expect(demand).toBe(192);
		expect((latest - earliest) * 4).toBe(188);
	});

	it("C3: fits all nine competitions with #424 slots and checks the known calendar deviations", async () => {
		const formats: Competition[] = [...leagues, ...internationals].map((id) =>
			competitionSchema.parse(readFormat(id)),
		);
		const built = buildStageGraph(formats, roster());
		if (!built.ok) throw new Error(JSON.stringify(built.error));
		const calendar = buildCalendar(built.graph, { year: 2026, seed: 42 });
		if (!calendar.ok) throw new Error(JSON.stringify(calendar.error));
		const { leagueStageStarts } = await import("./league-format-check.ts");
		const furthest: Record<string, number> = {};
		const occupied = new Map<number, number>();
		for (const { series } of calendar.stages) {
			for (const { day } of series)
				occupied.set(day, 1 + (occupied.get(day) ?? 0));
		}
		expect(Math.max(...occupied.values())).toBe(4);
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
				furthest[id] = Math.max(
					furthest[id] ?? 0,
					Math.abs(first - (real ?? Infinity)),
				);
			}
		}
		expect(furthest).toEqual({
			LCK: 14,
			LPL: 23,
			LEC: 33,
			LCP: 36,
			LCS: 49,
			CBLOL: 57,
		});
	});
});
