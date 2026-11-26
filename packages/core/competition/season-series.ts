import { draftStateWith } from "../draft";
import { aiTurn } from "../draft/ai-turn";
import { type LoadedContent, seriesCommands } from "../draft/series";
import type { Emitted } from "../server/dispatcher";

export interface SeasonFixture {
	readonly id: string;
	readonly teams: readonly [string, string];
	readonly round: number;
	readonly bestOf: 1 | 3 | 5;
	readonly priority: string;
	readonly groupPoints?: number | undefined;
	readonly tiebreaker?: boolean;
}

export function playSeasonSeries(
	{ content, match }: LoadedContent,
	fixture: SeasonFixture,
	seed: number,
) {
	const started = seriesCommands["series.start"](
		draftStateWith(content, match),
		{
			teams: fixture.teams,
			format: `bo${fixture.bestOf}`,
			seed,
			priority: fixture.priority,
			fearless: "off",
			timer: false,
			pool: content.champions.map(({ id }) => id),
			ai: ["coach", "coach"],
		},
	);
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
		ok: true as const,
		facts,
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
