import type { CoreError } from "@rift-legends/contracts";
import { HUMAN_SERIES_COMMANDS } from "@rift-legends/contracts";
import { aiTurn } from "../draft/ai-turn";
import { viewPlan } from "../draft/match-plan";
import { viewMatch } from "../draft/match-view";
import { type SeriesState, seriesCommands } from "../draft/series";
import { viewSummary } from "../draft/summary";
import { viewDraft } from "../draft/view";
import {
	type CommandHandler,
	type Emitted,
	type Outcome,
	QueryRejection,
} from "../server/dispatcher";
import type { SeasonSession } from "./handlers";
import { closeDay, openDayLog, recordSeries, slotSeries } from "./season-play";
import { seriesResult, startSeasonSeries } from "./season-series";
import { projectSchedule } from "./season-views";

const reject = (code: CoreError["code"], params: CoreError["params"] = {}) => ({
	ok: false as const,
	error: { code, params },
});

/** Whether the user's series is on, so its draft kinds belong to the season. */
export const isHumanSeriesOn = ({ human }: SeasonSession) =>
	human !== undefined && human.state.phase !== "over";

/** `series.start` of the user's series: the pending one of the day. */
export function playSeries(
	state: SeasonSession,
	{ series: id, timer }: { series: string; timer: boolean },
): Outcome<SeasonSession> {
	const { season } = state;
	if (!season) return reject("wrong-action", { expected: "season.create" });
	if (isHumanSeriesOn(state))
		return reject("wrong-action", { expected: "draft" });
	const slot = projectSchedule(season).find((slot) => slot.id === id);
	if (!slot || slot.id !== season.pending)
		return reject("unknown-series", { series: id });
	const series = slotSeries(season, slot);
	if (!series) return reject("unknown-series", { series: id });
	const started = startSeasonSeries(
		season.content,
		series.fixture,
		series.seed,
		{ fearless: series.fearless, human: season.humanTeam, timer },
	);
	if (!started.ok) return started;
	return {
		ok: true,
		state: {
			...state,
			human: { slot, series, state: started.state, facts: started.facts },
		},
		facts: started.facts,
	};
}

/** One command of the draft flow on the user's series; records it when it ends. */
const humanStep =
	(kind: string): CommandHandler<SeasonSession> =>
	(state, payload) => {
		const { human, season } = state;
		if (!human || !season || !isHumanSeriesOn(state))
			return reject("wrong-action", { expected: "season.playSeries" });
		const handler: CommandHandler<SeriesState> =
			kind === "draft.ai"
				? aiTurn
				: (seriesCommands[
						kind as keyof typeof seriesCommands
					] as CommandHandler<SeriesState>);
		const step = handler(human.state, payload);
		if (!step.ok) return step;
		const facts: Emitted[] = [...human.facts, ...step.facts];
		if (step.state.phase !== "over")
			return {
				ok: true,
				state: { ...state, human: { ...human, state: step.state, facts } },
				facts: step.facts,
			};
		const log = openDayLog(season);
		const played = {
			facts,
			human: step.state,
			...seriesResult(human.series.fixture, step.state, facts),
		};
		recordSeries(log, human.slot, human.series, played);
		const closed = closeDay(season, log, human.slot.day);
		if (!closed.ok) return closed;
		// The series facts were already sent; only the record and the stages are new.
		return {
			ok: true,
			state: {
				...state,
				season: { ...closed.season, pending: undefined },
				human: { ...human, state: step.state, facts },
			},
			facts: [...step.facts, ...log.facts.slice(facts.length)],
		};
	};

export const humanSeriesCommands = Object.fromEntries(
	HUMAN_SERIES_COMMANDS.map((kind) => [kind, humanStep(kind)]),
);

const idle = () =>
	new QueryRejection({
		code: "wrong-action",
		params: { expected: "season.playSeries" },
	});

export const humanSeriesQueries = {
	"draft.view": (state: SeasonSession, params: { team?: string }) =>
		state.human ? viewDraft(state.human.state, params) : null,
	"match.plan": (state: SeasonSession) =>
		state.human ? viewPlan(state.human.state) : idle(),
};

export const humanSummary = (state: SeasonSession) =>
	state.human ? viewSummary(state.human.state) : idle();

export const humanMatch = (state: SeasonSession, params: { game: number }) =>
	state.human ? viewMatch(state.human.state, params) : idle();
