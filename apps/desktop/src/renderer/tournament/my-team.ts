import { type BracketView, CONTRACT_VERSION } from "@rift-legends/contracts";
import type { CoreFact } from "../../shared/bridge";
import type { ScheduleSlot } from "../competition/schedule-view";
import type { SeasonOverview } from "../competition/season";
import { useCoreQuery } from "../core";

// Where the user's team stands in its tournament (plan 31, U10): still in it,
// out of it (the user goes on as a spectator) or champion.

export type MyTeamState = "in" | "out" | "champion";

const seasonFact = (fact: CoreFact) => fact.type.startsWith("competition.");

/**
 * Out: no series left to play, and nothing ahead. In a bracket that is no
 * series of it still to play with the team; elsewhere, the stage of its last
 * series is over without the team in a later one.
 */
export function useMyTeamState(
	sessionId: number,
	team: string,
	overview: SeasonOverview,
): MyTeamState {
	const slots = useCoreQuery<ScheduleSlot[]>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.schedule",
			sessionId,
			params: { team },
		},
		{ affectedBy: seasonFact },
	).data;
	const waiting = slots?.some(({ status }) => status !== "played") ?? true;
	const last = slots?.filter(({ status }) => status === "played").at(-1);
	const bracket = useCoreQuery<BracketView>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.bracket",
			sessionId,
			params: {
				competition: last?.competition ?? "",
				stage: last?.stage ?? "",
			},
		},
		{
			affectedBy: seasonFact,
			enabled: !waiting && last?.match !== undefined,
		},
	).data;
	return myTeamState({ team, slots, bracket, overview });
}

/** Where `team` stands, from its series, the bracket of its last one and the overview. */
export function myTeamState({
	team,
	slots,
	bracket,
	overview,
}: {
	team: string;
	/** Its series (`competition.schedule` with `team`); `undefined` while loading. */
	slots: readonly ScheduleSlot[] | undefined;
	/** The bracket of its last series, when that series is in one. */
	bracket: BracketView | undefined;
	overview: SeasonOverview;
}): MyTeamState {
	const waiting = slots?.some(({ status }) => status !== "played") ?? true;
	const last = slots?.filter(({ status }) => status === "played").at(-1);
	const competition = overview.competitions.find(
		({ id }) => id === last?.competition,
	);
	if (competition?.champion === team) return "champion";
	if (waiting || !last) return "in";
	if (last.match !== undefined)
		return bracket?.matches.some(
			({ status, teamA, teamB }) =>
				(status === "waiting" || status === "ready") &&
				(teamA === team || teamB === team),
		) === false
			? "out"
			: "in";
	const stage = competition?.stages.find(({ stage }) => stage === last.stage);
	return stage?.status === "finished" ? "out" : "in";
}
