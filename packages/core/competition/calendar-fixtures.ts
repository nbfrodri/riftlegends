import { min } from "../math/int";
import type { Slot } from "./bracket";
import {
	balancedCrossSchedule,
	crossGroupSchedule,
	groupSchedule,
} from "./groups";
import type { StageOutcomes } from "./qualification";
import { roundRobin } from "./round-robin";
import { resolveStage } from "./season";
import { seedGroups } from "./stage-draw";
import {
	type Stage,
	type StageGraph,
	type StageNode,
	stageKey,
} from "./stage-model";

export interface FixtureSlot {
	readonly id: string;
	readonly teams: readonly [string | null, string | null];
	/** Entrant slots also distinguish pending teams in a round robin. */
	readonly entrants: readonly string[];
	readonly after: readonly string[];
	readonly bestOf?: 1 | 3 | 5;
	readonly groupPoints?: number;
	readonly earliestWeek?: number;
}

function bracketSlots(
	node: StageNode,
	bracket: NonNullable<StageNode["bracket"]>,
	teams: readonly string[] | undefined,
	outcomes: StageOutcomes,
): FixtureSlot[] {
	const previous = outcomes.get(stageKey(node.ref))?.bracket;
	const finished = new Map(previous?.matches.map((match) => [match.id, match]));
	const entrant = (slot: Slot) =>
		slot.kind === "seed"
			? (teams?.[slot.rank - 1] ?? null)
			: (finished.get(slot.match)?.[slot.kind] ?? null);

	return bracket.matches.flatMap(({ id, a, b, side }) => {
		const match = finished.get(id);
		if (match?.status === "skipped") return [];
		const pair = [
			match?.teamA ?? entrant(a),
			match?.teamB ?? entrant(b),
		] as const;
		return [
			{
				id,
				teams: pair,
				entrants: pair.filter((team) => team !== null),
				after:
					side === "reset"
						? ["GF"]
						: [a, b].flatMap((slot) =>
								slot.kind === "seed" ? [] : [slot.match],
							),
			},
		];
	});
}

type Swiss = Extract<Stage["play"], { type: "swiss" }>;

/** Same-record pairings have fixed counts until a record has an odd field.
 * From that point reserve for all remaining teams, regardless of results. */
function swissSlots({ size, wins, losses, maxRounds }: Swiss): FixtureSlot[] {
	let records = new Map<number, number>([[0, size]]);
	let active = size;
	let splitRecords = false;
	let previous: string[] = [];
	const slots: FixtureSlot[] = [];
	const limit = min(maxRounds ?? wins + losses - 1, wins + losses - 1);
	for (let round = 1; round <= limit && active > 0; round++) {
		const current: string[] = [];
		for (let series = 0; series + 1 < active; series += 2) {
			const id = `swiss-${round}-${current.length + 1}`;
			current.push(id);
			slots.push({ id, teams: [null, null], entrants: [], after: previous });
		}
		previous = current;
		splitRecords ||= [...records.values()].some((count) => count % 2 !== 0);
		if (splitRecords) continue;
		const next = new Map<number, number>();
		for (const [won, count] of records) {
			if (won + 1 < wins)
				next.set(won + 1, (next.get(won + 1) ?? 0) + count / 2);
			if (round - won < losses) next.set(won, (next.get(won) ?? 0) + count / 2);
		}
		records = next;
		active = [...records.values()].reduce((sum, count) => sum + count, 0);
	}
	return slots;
}

export function stageFixtures(
	graph: StageGraph,
	node: StageNode,
	outcomes: StageOutcomes,
	seed: number,
	year: number,
) {
	const resolution = resolveStage(graph, node.ref, outcomes, seed, year);
	if (resolution.status === "error") return { error: resolution.error };
	const ready = resolution.status === "ready" ? resolution : undefined;
	const ids = ready?.entrants.map(({ team }) => team);
	const play = node.stage.play;
	if (node.bracket)
		return { fixtures: bracketSlots(node, node.bracket, ids, outcomes) };
	if (play.type === "swiss") return { fixtures: swissSlots(play) };
	if (play.type !== "roundRobin" && play.type !== "groups")
		throw new Error("Missing bracket in the stage graph");

	const entrants =
		ids ?? Array.from({ length: play.size }, (_, index) => String(index + 1));
	const special = play.type === "groups" ? play.finalRound : undefined;
	let days: ReturnType<typeof roundRobin>;
	if (play.type === "roundRobin") {
		days = roundRobin(entrants, play.rounds);
	} else {
		const groups =
			ready?.groups ??
			seedGroups(
				node,
				entrants.map((team) => ({
					team,
					league: "",
					region: "",
					initialSeed: 0,
				})),
			).groups ??
			[];
		const schedule =
			play.seeding === "cross" ? crossGroupSchedule : groupSchedule;
		days = special
			? balancedCrossSchedule(groups[0] ?? [], groups[1] ?? [])
			: schedule(groups, play.inner.rounds);
	}
	const fixtures: FixtureSlot[] = [];
	for (const [round, day] of days.entries()) {
		const final = special && round === days.length - 1 ? special : undefined;
		const after = final ? fixtures.map(({ id }) => id) : [];
		for (const [index, { a, b }] of day.fixtures.entries()) {
			fixtures.push({
				id: `round-${round + 1}-${index + 1}`,
				teams: ready ? [a, b] : [null, null],
				entrants: [a, b],
				after,
				...(special &&
					play.type === "groups" && {
						bestOf: final?.bestOf ?? play.inner.bestOf,
						groupPoints: final?.groupPoints ?? 1,
					}),
				...(final && { earliestWeek: final.week }),
			});
		}
	}
	return { fixtures };
}
