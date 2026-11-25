import { validateFormat } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { buildStageGraph, resolveStage, stageKey } from "../index";
import { buildDoubleElim } from "./bracket";
import { resolveBracket } from "./bracket-state";
import { pairSwissRound } from "./swiss";

const files = import.meta.glob("../content/real/formats/*.json", {
	eager: true,
	import: "default",
});
const leagues = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];
const teams = leagues.flatMap((competition) =>
	Array.from({ length: 4 }, (_, i) => ({
		id: `${competition}-${i + 1}`,
		competition,
		region: competition,
		rank: i + 1,
	})),
);

function replayBracket(
	bracket: ReturnType<typeof buildDoubleElim>,
	ids: string[],
) {
	const results: Record<string, string> = {};
	for (const match of bracket.matches) {
		const ready = resolveBracket(bracket, ids, results).matches.find(
			(m) => m.id === match.id,
		);
		if (ready?.status === "ready" && ready.teamA !== null)
			results[match.id] = ready.teamA;
	}
	return resolveBracket(bracket, ids, results);
}

describe("chained 2026 international formats", () => {
	it.each([
		[
			"first-stand",
			[2, 2, 1, 1, 1, 1],
			[
				["LPL-1", "LCK-2", "LEC-1", "LCP-1"],
				["LCK-1", "LPL-2", "LCS-1", "CBLOL-1"],
			],
		],
		["msi", [2, 2, 2, 2, 2, 1], [["LCK-2", "LCS-2", "LEC-2", "LCP-2"]]],
		["worlds", [4, 4, 3, 3, 3, 2], [["LCS-3", "LEC-3", "CBLOL-2", "LCP-3"]]],
	] as const)(
		"%s validates and uses earlier results for its next stage",
		(id, counts, participants) => {
			const parsed = validateFormat(
				files[`../content/real/formats/${id}.json`],
			);
			expect(parsed).toMatchObject({ ok: true });
			if (!parsed.ok) throw new Error("Invalid international format");
			const event = parsed.competition;
			const domestic = leagues.map((league, i) => ({
				id: league,
				kind: "league",
				verified: false,
				tiebreak: [],
				stages: [
					{
						id: "split",
						entrants: {
							kind: "fixed",
							teams: teams
								.filter((t) => t.competition === league)
								.map((t) => t.id),
						},
						window: { startWeek: 0, weeks: 1, matchDays: 2 },
						play: { type: "roundRobin", size: 4, rounds: 1, bestOf: 3 },
					},
				],
				slots: [
					{
						to: id,
						rule: "standing",
						stage: "split",
						count: counts[i],
						cascade: "next",
					},
				],
			}));
			const built = buildStageGraph([...domestic, event], teams);
			expect(built).toMatchObject({ ok: true });
			if (!built.ok) throw new Error("Invalid season graph");
			const outcomes = new Map<
				string,
				Parameters<typeof resolveStage>[2] extends ReadonlyMap<string, infer V>
					? V
					: never
			>();
			for (const league of leagues) {
				outcomes.set(stageKey({ competition: league, stage: "split" }), {
					standings: {
						pending: [],
						rows: teams
							.filter((t) => t.competition === league)
							.map((t) => ({
								team: t.id,
								rank: t.rank,
								seriesWins: 0,
								seriesLosses: 0,
								gameWins: 0,
								gameLosses: 0,
								explanation: { criterion: "none", tied: [], values: {} },
							})),
					},
				});
			}
			const resolve = (stage: string) =>
				resolveStage(
					built.graph,
					{ competition: id, stage },
					outcomes,
					2026,
					2026,
				);
			const initial = id === "first-stand" ? ["groupA", "groupB"] : ["playin"];
			const next =
				id === "first-stand" ? "knockout" : id === "msi" ? "bracket" : "swiss";
			const openingTeams = new Set<string>();
			expect(resolve(next)).toMatchObject({ status: "pending" });
			for (const [index, stage] of initial.entries()) {
				const ready = resolve(stage);
				expect(ready.status).toBe("ready");
				const play = event.stages.find((s) => s.id === stage)?.play;
				if (ready.status !== "ready" || play?.type !== "doubleElim")
					throw new Error("Missing opening bracket");
				const entrants = ready.entrants.map((e) => e.team);
				expect([...entrants].sort()).toEqual(
					[...(participants[index] ?? [])].sort(),
				);
				for (const team of entrants) {
					expect(openingTeams.has(team)).toBe(false);
					openingTeams.add(team);
				}
				const bracket = replayBracket(buildDoubleElim(play), entrants);
				if (id === "first-stand") {
					expect(bracket.matches.map((m) => m.id)).toEqual([
						"U1-1",
						"U1-2",
						"U2-1",
						"L1-1",
						"L2-1",
					]);
					expect(bracket.champion).toBe(
						bracket.matches.find((m) => m.id === "U2-1")?.winner,
					);
				}
				outcomes.set(stageKey({ competition: id, stage }), { bracket });
			}
			const ready = resolve(next);
			expect(ready.status).toBe("ready");
			if (ready.status !== "ready") throw new Error("Next stage still pending");
			expect(new Set(ready.entrants.map((e) => e.team)).size).toBe(
				ready.entrants.length,
			);
			expect(
				ready.entrants.filter((e) => e.source.kind === "bracket"),
			).toHaveLength(id === "first-stand" ? 4 : 1);
			if (id === "worlds") {
				expect(
					[1, 2, 3, 4].map(
						(pot) => ready.entrants.filter((e) => e.pot === pot).length,
					),
				).toEqual([4, 4, 4, 4]);
				const swiss = event.stages.find((s) => s.play.type === "swiss")?.play;
				if (swiss?.type !== "swiss") throw new Error("Missing Swiss");
				const round = pairSwissRound(
					ready.entrants.map(({ team, region, league }) => ({
						id: team,
						region,
						league,
					})),
					[],
					swiss,
					33,
					{ competition: 6, season: 2026, stage: 1 },
				);
				expect(round?.relaxed).toEqual([]);
				expect(round?.pairings).toHaveLength(8);
				expect(resolve("knockout")).toMatchObject({ status: "pending" });
			}
		},
	);
});
