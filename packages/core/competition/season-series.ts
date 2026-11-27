import { draftStateWith } from "../draft";
import { aiTurn } from "../draft/ai-turn";
import {
	type LoadedContent,
	type SeriesState,
	seriesCommands,
} from "../draft/series";
import type { Emitted } from "../server/dispatcher";

export type Fearless = "hard" | "soft" | "off";

export interface SeasonFixture {
	readonly id: string;
	readonly teams: readonly [string, string];
	readonly round: number;
	readonly bestOf: 1 | 3 | 5;
	readonly priority: string;
	readonly groupPoints?: number | undefined;
	readonly tiebreaker?: boolean;
	/** In a Swiss round, the constraints relaxed to pair it. */
	readonly relaxed?: readonly ("region" | "rematch")[];
}

/**
 * The series of a fixture as the season starts it. A `human` team is played by
 * the user; the other one, and both when it is absent, by the coach AI.
 */
export function startSeasonSeries(
	{ content, match }: LoadedContent,
	fixture: SeasonFixture,
	seed: number,
	options: {
		readonly fearless: Fearless;
		readonly human?: string | undefined;
		readonly timer?: boolean;
	},
) {
	return seriesCommands["series.start"](draftStateWith(content, match), {
		teams: fixture.teams,
		format: `bo${fixture.bestOf}`,
		seed,
		priority: fixture.priority,
		fearless: options.fearless,
		timer: options.timer ?? false,
		pool: content.champions.map(({ id }) => id),
		ai: fixture.teams.map((team) =>
			team === options.human ? null : "coach",
		) as ["coach" | null, "coach" | null],
	});
}

/** Winner, score and the result the standings take, from a finished series. */
export function seriesResult(
	fixture: SeasonFixture,
	state: SeriesState,
	facts: readonly Emitted[],
) {
	const [a, b] = fixture.teams;
	const [winsA, winsB] = state.wins;
	const winner = winsA > winsB ? a : b;
	const winnerSeconds = facts.reduce(
		(total, fact) =>
			fact.type === "match.ended" &&
			fact.winner === winner &&
			typeof fact.duration === "number"
				? total + fact.duration
				: total,
		0,
	);
	return {
		winner,
		score: state.wins,
		result: {
			a,
			b,
			winsA,
			winsB,
			winnerSeconds,
			groupPoints: fixture.groupPoints ?? 1,
		},
	};
}

export function playSeasonSeries(
	content: LoadedContent,
	fixture: SeasonFixture,
	seed: number,
	fearless: Fearless,
) {
	const started = startSeasonSeries(content, fixture, seed, { fearless });
	if (!started.ok) return started;
	let state = started.state;
	const facts: Emitted[] = [...started.facts];
	while (state.phase !== "over") {
		const step =
			state.phase === "result"
				? seriesCommands["match.play"](state, {})
				: aiTurn(state, {});
		if (!step.ok) return step;
		facts.push(...step.facts);
		state = step.state;
	}
	return {
		ok: true as const,
		facts,
		state,
		...seriesResult(fixture, state, facts),
	};
}
