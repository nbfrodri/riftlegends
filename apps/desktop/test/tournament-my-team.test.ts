import type { BracketView } from "@rift-legends/contracts";
import { describe, expect, test } from "vitest";
import type { ScheduleSlot } from "../src/renderer/competition/schedule-view";
import type { SeasonOverview } from "../src/renderer/competition/season";
import { myTeamState } from "../src/renderer/tournament/my-team";

// U10 (plan 31): once out of its tournament, the user's team is shown as out
// and the user goes on as a spectator.

const slot = (
	stage: string,
	status: ScheduleSlot["status"],
	teams: [string, string],
	match?: string,
): ScheduleSlot => ({
	id: `${stage}-${teams.join("-")}`,
	competition: "custom",
	stage,
	day: 0,
	teams,
	status,
	...(match && { match }),
});

const overview = (
	stages: Record<string, "pending" | "live" | "finished">,
	champion?: string,
): SeasonOverview => ({
	year: 2026,
	day: champion ? null : 1,
	competitions: [
		{
			id: "custom",
			status: champion ? "finished" : "live",
			...(champion && { champion }),
			stages: Object.entries(stages).map(([stage, status]) => ({
				stage,
				play: "singleElim" as const,
				status,
				startDay: 0,
				endDay: 9,
			})),
		},
	],
});

const final = (teamA: string | null, status: "waiting" | "ready" | "done") =>
	({
		matches: [
			{
				id: "F",
				side: "upper",
				round: 2,
				bestOf: 1,
				teamA,
				teamB: null,
				priority: null,
				status,
				winner: null,
				loser: null,
				from: [
					{ kind: "winner", match: "SF1" },
					{ kind: "winner", match: "SF2" },
				],
			},
		],
		champion: null,
		losses: {},
	}) as BracketView;

describe("U10: where the user's team stands", () => {
	test("a series still to play keeps the team in", () => {
		expect(
			myTeamState({
				team: "forge",
				slots: [slot("league", "ready", ["forge", "shoal"])],
				bracket: undefined,
				overview: overview({ league: "live" }),
			}),
		).toBe("in");
	});

	test("a bracket series lost with nothing ahead puts the team out", () => {
		const slots = [slot("bracket", "played", ["forge", "shoal"], "SF1")];
		expect(
			myTeamState({
				team: "forge",
				slots,
				bracket: final("shoal", "waiting"),
				overview: overview({ bracket: "live" }),
			}),
		).toBe("out");
		expect(
			myTeamState({
				team: "forge",
				slots,
				bracket: final("forge", "waiting"),
				overview: overview({ bracket: "live" }),
			}),
		).toBe("in");
	});

	test("a finished stage without a place in the next one puts the team out", () => {
		const slots = [slot("league", "played", ["forge", "shoal"])];
		expect(
			myTeamState({
				team: "forge",
				slots,
				bracket: undefined,
				overview: overview({ league: "finished", playoffs: "live" }),
			}),
		).toBe("out");
		expect(
			myTeamState({
				team: "forge",
				slots,
				bracket: undefined,
				overview: overview({ league: "live", playoffs: "pending" }),
			}),
		).toBe("in");
	});

	test("the winner of the last stage is the champion", () => {
		expect(
			myTeamState({
				team: "forge",
				slots: [slot("bracket", "played", ["forge", "shoal"], "F")],
				bracket: undefined,
				overview: overview({ bracket: "finished" }, "forge"),
			}),
		).toBe("champion");
	});
});
