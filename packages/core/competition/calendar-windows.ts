import { MAX_SERIES_PER_DAY } from "@rift-legends/contracts";
import { max, min } from "../math/int";
import { awardPlaces, type StageOutcomes } from "./qualification";
import {
	type StageGraph,
	type StageNode,
	selectedPlaces,
	sourceRef,
	sourcesOf,
	stageKey,
} from "./stage-model";

export const DAYS_PER_WEEK = 7;
export const DAILY_CAPACITY = MAX_SERIES_PER_DAY;

export interface Window {
	readonly startDay: number;
	readonly endDay: number;
}

export interface StageWindow extends Window {
	readonly node: StageNode;
	readonly after: ReadonlySet<string>;
	readonly matchDays: number;
	readonly maxSeriesPerDay: number;
	readonly possibleTeams: ReadonlySet<string>;
	readonly separateQualifiers: boolean;
}

const daysInYear = (year: number) =>
	year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;

interface StageBlock {
	group: string | undefined;
	previous: string[];
	current: string[];
}

function stageOrder(graph: StageGraph) {
	const order: { key: string; node: StageNode; after: ReadonlySet<string> }[] =
		[];
	const blocks = new Map<string, StageBlock>();
	for (const [key, node] of graph.nodes) {
		const { competition } = node.ref;
		const after = new Set(graph.dependencies.get(key));
		if (graph.leagues.has(competition)) {
			const group = node.stage.parallelGroup;
			const block = blocks.get(competition);
			const next: StageBlock =
				group !== undefined && block?.group === group
					? block
					: { group, previous: block?.current ?? [], current: [] };
			for (const previous of next.previous) after.add(previous);
			next.current.push(key);
			blocks.set(competition, next);
		}
		order.push({ key, node, after });
	}
	return order;
}

/** Calendar week 0 starts January 1, including for the Leaguepedia windows. */
export function stageWindows(
	graph: StageGraph,
	year: number,
	outcomes: StageOutcomes,
) {
	const configured = stageOrder(graph).map(({ key, node, after }) => {
		const { startWeek, weeks, matchDays, maxSeriesPerDay } = node.stage.window;
		return {
			key,
			node,
			after,
			matchDays,
			maxSeriesPerDay,
			startDay: min(startWeek * DAYS_PER_WEEK, daysInYear(year)),
			endDay: min((startWeek + weeks) * DAYS_PER_WEEK, daysInYear(year)),
		};
	});
	const pending = configured.sort(
		(a, b) => a.endDay - b.endDay || a.startDay - b.startDay,
	);
	const windows = new Map<string, StageWindow>();
	const internationalTeams = new Map<string, Set<string>>();
	while (pending.length > 0) {
		const index = pending.findIndex(({ after }) =>
			[...after].every((key) => windows.has(key)),
		);
		if (index === -1) return { cycle: pending[0]?.node };
		const item = pending.splice(index, 1)[0];
		if (!item) break;
		const { node } = item;
		const possibleTeams = new Set<string>();
		const sources = sourcesOf(node.stage);
		for (const source of sources) {
			if (source.kind === "fixed") {
				for (const team of source.teams) possibleTeams.add(team);
			} else if (source.kind === "standing" || source.kind === "bracket") {
				const origin = sourceRef(source, node);
				for (const team of windows.get(stageKey(origin))?.possibleTeams ?? [])
					possibleTeams.add(team);
			} else {
				const { competition } = node.ref;
				for (const { league, place } of selectedPlaces(graph, node, source) ??
					[]) {
					const awarded = awardPlaces(
						graph,
						competition,
						league,
						place,
						outcomes,
					);
					if ("places" in awarded) {
						const entry = awarded.places.get(place);
						if (entry) possibleTeams.add(entry.team);
					} else {
						for (const team of graph.teams.values()) {
							if (team.competition === league) possibleTeams.add(team.id);
						}
					}
				}
			}
		}
		const separateQualifiers = sources.every(
			({ kind }) => kind === "qualified" || kind === "pots",
		);
		windows.set(item.key, { ...item, possibleTeams, separateQualifiers });
		if (!graph.leagues.has(node.ref.competition)) {
			const teams =
				internationalTeams.get(node.ref.competition) ?? new Set<string>();
			for (const team of possibleTeams) teams.add(team);
			internationalTeams.set(node.ref.competition, teams);
		}
	}

	const events = new Map<string, Window>();
	for (const { node, startDay, endDay } of windows.values()) {
		const id = node.ref.competition;
		if (!internationalTeams.has(id)) continue;
		const event = events.get(id);
		events.set(
			id,
			event
				? {
						startDay: min(startDay, event.startDay),
						endDay: max(endDay, event.endDay),
					}
				: { startDay, endDay },
		);
	}
	const absences = new Map<string, Window[]>();
	for (const [event, window] of events) {
		for (const team of internationalTeams.get(event) ?? []) {
			const current = absences.get(team) ?? [];
			current.push(window);
			absences.set(team, current);
		}
	}
	return { windows, absences, seasonDays: daysInYear(year) };
}
