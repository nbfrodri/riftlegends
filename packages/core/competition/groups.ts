import { abs, max } from "../math/int";
import { type Fixture, type Matchday, roundRobin } from "./round-robin";

export interface GroupTeam {
	readonly id: string;
	/** Teams of one region avoid sharing a group when there is an alternative. */
	readonly region?: string;
}

export interface GroupOptions {
	readonly count: number;
	/** Team count per group (LPL: 8 and 6). Defaults to as even as possible, larger groups first. */
	readonly sizes?: readonly number[];
}

/** Group indexes in the order the snake hands out places, skipping full groups. */
function snakeSlots(sizes: readonly number[]): number[] {
	const slots: number[] = [];
	const rows = sizes.reduce(max);
	for (let row = 0; row < rows; row++) {
		const order = sizes.map((_, group) => group);
		if (row % 2 === 1) order.reverse();
		for (const group of order) {
			if (row < (sizes[group] as number)) slots.push(group);
		}
	}
	return slots;
}

/**
 * Splits seeded teams (best first) into groups with a snake: 1, 2, 2, 1, 1, 2...
 * Then teams of the same region are swapped apart where that helps (see
 * `separateRegions`). Without regions this is the plain snake.
 */
export function assignGroups(
	teams: readonly GroupTeam[],
	options: GroupOptions,
): string[][] {
	const { count } = options;
	if (!Number.isInteger(count) || count < 1 || count > teams.length) {
		throw new RangeError(
			`Cannot make ${count} groups of ${teams.length} teams`,
		);
	}
	if (new Set(teams.map((team) => team.id)).size !== teams.length) {
		throw new RangeError("Team ids must be unique");
	}
	const sizes =
		options.sizes ??
		Array.from(
			{ length: count },
			(_, group) =>
				(teams.length - (teams.length % count)) / count +
				(group < teams.length % count ? 1 : 0),
		);
	if (
		sizes.length !== count ||
		sizes.some((size) => !Number.isInteger(size) || size < 1) ||
		sizes.reduce((sum, size) => sum + size, 0) !== teams.length
	) {
		throw new RangeError(
			"Group sizes must be positive and add up to the teams",
		);
	}

	const groups: GroupTeam[][] = sizes.map(() => []);
	for (const [index, group] of snakeSlots(sizes).entries()) {
		(groups[group] as GroupTeam[]).push(teams[index] as GroupTeam);
	}
	separateRegions(groups, new Map(teams.map((team, seed) => [team.id, seed])));
	return groups.map((group) => group.map((team) => team.id));
}

const replaceAt = (group: GroupTeam[], index: number, team: GroupTeam) =>
	group.map((current, at) => (at === index ? team : current));

/** Pairs of teams from the same region sharing a group. */
function sameRegionPairs(group: readonly GroupTeam[]): number {
	const counts = new Map<string, number>();
	for (const { region } of group) {
		if (region !== undefined) counts.set(region, (counts.get(region) ?? 0) + 1);
	}
	let pairs = 0;
	for (const count of counts.values()) pairs += (count * (count - 1)) / 2;
	return pairs;
}

/**
 * Swaps teams between groups while a swap lowers the same-region pairs. It
 * takes the swap that lowers them most and, on a tie, the one that moves the
 * seeds the least, so the snake survives wherever regions do not clash. The
 * result is never worse than the snake it starts from.
 */
function separateRegions(
	groups: GroupTeam[][],
	seedOf: ReadonlyMap<string, number>,
): void {
	for (;;) {
		let best: { g: number; i: number; h: number; j: number } | null = null;
		let bestGain = 0;
		let bestDistance = 0;
		for (let g = 0; g < groups.length; g++) {
			for (let h = g + 1; h < groups.length; h++) {
				const before =
					sameRegionPairs(groups[g] as GroupTeam[]) +
					sameRegionPairs(groups[h] as GroupTeam[]);
				for (const [i, x] of (groups[g] as GroupTeam[]).entries()) {
					for (const [j, y] of (groups[h] as GroupTeam[]).entries()) {
						const left = replaceAt(groups[g] as GroupTeam[], i, y);
						const right = replaceAt(groups[h] as GroupTeam[], j, x);
						const gain =
							before - sameRegionPairs(left) - sameRegionPairs(right);
						const distance = abs(
							(seedOf.get(x.id) as number) - (seedOf.get(y.id) as number),
						);
						if (
							gain > bestGain ||
							(gain === bestGain && gain > 0 && distance < bestDistance)
						) {
							best = { g, i, h, j };
							bestGain = gain;
							bestDistance = distance;
						}
					}
				}
			}
		}
		if (best === null) return;
		const { g, i, h, j } = best;
		const x = (groups[g] as GroupTeam[])[i] as GroupTeam;
		(groups[g] as GroupTeam[])[i] = (groups[h] as GroupTeam[])[j] as GroupTeam;
		(groups[h] as GroupTeam[])[j] = x;
	}
}

/** Every group plays its own round robin; day i of each group falls on day i. */
export function groupSchedule(
	groups: readonly (readonly string[])[],
	rounds: 1 | 2,
): Matchday[] {
	const schedules = groups
		.filter((group) => group.length >= 2)
		.map((group) => roundRobin(group, rounds));
	const days = schedules.map((schedule) => schedule.length).reduce(max, 0);
	return Array.from({ length: days }, (_, day) => ({
		fixtures: schedules.flatMap((s) => s[day]?.fixtures ?? []),
		byes: schedules.flatMap((s) => s[day]?.byes ?? []),
	}));
}

/**
 * Crossed groups (LCK Cup): each team plays only the teams of the other
 * groups. It takes the days of a full round robin and drops the same-group
 * fixtures, so nobody plays twice a day. `byes` stays empty: with crossed
 * groups a team without a fixture is not resting, it is waiting for the calendar.
 */
export function crossGroupSchedule(
	groups: readonly (readonly string[])[],
	rounds: 1 | 2,
): Matchday[] {
	const groupOf = new Map<string, number>();
	for (const [index, group] of groups.entries()) {
		for (const id of group) groupOf.set(id, index);
	}
	const keep = ({ a, b }: Fixture) => groupOf.get(a) !== groupOf.get(b);
	return roundRobin(groups.flat(), rounds)
		.map((day) => ({ fixtures: day.fixtures.filter(keep), byes: [] }))
		.filter((day) => day.fixtures.length > 0);
}
