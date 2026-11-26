import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoreRequestError, useCore } from "../core";
import type { SeasonHandle, SeasonOverview } from "./season";

// «Jugar día», «Hasta fin de fase» and «Toda la temporada» (plan 31, U2): the
// renderer plays each day a few series at a time (`season.playDay` with
// `maxSeries`), so no request keeps the core busy for long and «Parar» takes
// effect after the current batch, while the core plays in its own process (E3).

/** Series per request: a busy day of a real season takes seconds (#584). */
const BATCH_SERIES = 2;

export type AdvanceMode = "day" | "stage" | "season";

export interface StageTarget {
	readonly competition: string;
	readonly stage: string;
	readonly name?: SeasonOverview["competitions"][number]["stages"][number]["name"];
	readonly endDay: number;
}

/** The user's series that stopped the advance (#482, `competition.seriesPending`). */
export interface PendingSeries {
	readonly series: string;
	readonly teams: readonly [string, string];
}

export interface AdvanceRun {
	readonly mode: AdvanceMode;
	readonly fromDay: number;
	readonly toDay: number;
	/** The day being played. */
	readonly day: number;
	/** The stage «Hasta fin de fase» plays to the end. */
	readonly target: StageTarget | null;
}

/**
 * The stage «Hasta fin de fase» plays to the end: of the stages under way on
 * the next day (or, between stages, the next to start), the one that ends first.
 */
export function stageTarget(overview: SeasonOverview): StageTarget | null {
	const { day } = overview;
	if (day === null) return null;
	const open = overview.competitions.flatMap(({ id, stages }) =>
		stages
			.filter(({ status }) => status !== "finished")
			.map((stage) => ({ ...stage, competition: id })),
	);
	const started = open.filter(({ startDay }) => startDay <= day);
	const firstStart = Math.min(...open.map(({ startDay }) => startDay));
	const candidates = started.length
		? started
		: open.filter(({ startDay }) => startDay === firstStart);
	const [target] = candidates.sort((a, b) => a.endDay - b.endDay);
	return target
		? {
				competition: target.competition,
				stage: target.stage,
				...(target.name && { name: target.name }),
				endDay: target.endDay,
			}
		: null;
}

const finished = (overview: SeasonOverview, target: StageTarget) =>
	overview.competitions
		.find(({ id }) => id === target.competition)
		?.stages.find(({ stage }) => stage === target.stage)?.status === "finished";

const seasonEnd = (overview: SeasonOverview) =>
	Math.max(
		...overview.competitions.flatMap(({ stages }) =>
			stages.map(({ endDay }) => endDay),
		),
	);

/** Where the pending series is kept, when it must outlive the screen (U10). */
export interface PendingStore {
	readonly pending: PendingSeries | null;
	setPending(pending: PendingSeries | null): void;
}

export function useSeasonAdvance(season: SeasonHandle, store?: PendingStore) {
	const core = useCore();
	const [run, setRun] = useState<AdvanceRun | null>(null);
	const [local, setLocal] = useState<PendingSeries | null>(null);
	const pending = store ? store.pending : local;
	const setPending = store ? store.setPending : setLocal;
	const [error, setError] = useState<CoreRequestError | null>(null);
	const stopped = useRef(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const overview = useCallback(async () => {
		const result = await core.query({
			v: CONTRACT_VERSION,
			kind: "season.overview",
			sessionId: season.sessionId,
			params: {},
		});
		if (!result.ok) throw new CoreRequestError(result.error);
		return result.view as SeasonOverview;
	}, [core, season.sessionId]);

	const start = useCallback(
		async (mode: AdvanceMode) => {
			stopped.current = false;
			setError(null);
			try {
				let current = await overview();
				const fromDay = current.day;
				if (fromDay === null) return;
				const target = mode === "stage" ? stageTarget(current) : null;
				const toDay =
					mode === "day" ? fromDay + 1 : (target?.endDay ?? seasonEnd(current));
				setRun({ mode, fromDay, toDay, day: fromDay, target });
				while (current.day !== null) {
					const result = await core.send({
						v: CONTRACT_VERSION,
						kind: "season.playDay",
						sessionId: season.sessionId,
						expectedPosition: season.position.current,
						payload: { day: current.day, maxSeries: BATCH_SERIES },
					});
					if (!result.ok) throw new CoreRequestError(result.error);
					season.position.current = result.position;
					const waiting = result.facts.find(
						({ type }) => type === "competition.seriesPending",
					);
					const playing = current.day;
					current = await overview();
					if (!mounted.current) return;
					const day = current.day ?? toDay;
					setRun((shown) => shown && { ...shown, day });
					if (waiting) {
						setPending({
							series: waiting.series as string,
							teams: waiting.teams as [string, string],
						});
						break;
					}
					// A day that is not closed yet goes on after «Parar»; the run ends at a batch.
					const closed = current.day !== playing;
					if (
						stopped.current ||
						(closed &&
							(mode === "day" || (target && finished(current, target))))
					)
						break;
				}
			} catch (caught) {
				if (!(caught instanceof CoreRequestError)) throw caught;
				if (mounted.current) setError(caught);
			} finally {
				if (mounted.current) setRun(null);
			}
		},
		[core, overview, season, setPending],
	);

	const stop = useCallback(() => {
		stopped.current = true;
	}, []);

	useEffect(
		() => () => {
			stopped.current = true;
		},
		[],
	);

	return { run, pending, error, start, stop };
}
