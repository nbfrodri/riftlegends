import { type AiOfTeam, ROLES } from "@rift-legends/contracts";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import type { CommandHandler, Outcome } from "../server/dispatcher";
import { takeSides } from "../test/take-sides";
import { type GameDraft, type Turn, turn } from "./game";
import { DRAFT_ORDER } from "./order";
import { initialSeries, type SeriesState, seriesCommands } from "./series";

export type Accepted = Extract<Outcome<SeriesState>, { ok: true }>;
export const run = (state: SeriesState, kind: string, payload: object) =>
	(
		seriesCommands[
			kind as keyof typeof seriesCommands
		] as CommandHandler<SeriesState>
	)(state, payload);
export const ok = (outcome: Outcome<SeriesState>): Accepted => {
	if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
	return outcome;
};

const POOL = fictionalContent.champions.map((c) => c.id);
/** The champions each team's players main, in role order. */
const mains = (team: string) =>
	ROLES.map(
		(role) =>
			fictionalContent.players.find((p) => p.team === team && p.role === role)
				?.mains[0] ?? "",
	);

export const loaded = (match = fictionalMatchContent): SeriesState => ({
	...initialSeries,
	content: fictionalContent,
	match,
});

export function drafted(state = loaded(), ai?: [AiOfTeam, AiOfTeam]) {
	const current = ok(
		run(state, "series.start", {
			teams: ["forge", "shoal"],
			format: "bo3",
			fearless: "off",
			timer: false,
			pool: POOL,
			seed: 11,
			...(ai ? { ai } : {}),
		}),
	).state;
	return draftWith(takeSides(current, "forge"));
}

/** Drafts the current game: each team picks its players' mains. */
export function draftWith(state: SeriesState) {
	let current = state;
	const team = (side: "blue" | "red") => current.draft?.[side] ?? "";
	const wanted = { blue: mains(team("blue")), red: mains(team("red")) };
	const next = { blue: 0, red: 0 };
	for (const step of DRAFT_ORDER) {
		const { team, side } = turn(current.draft as GameDraft) as Turn;
		if (step.action === "ban") {
			current = ok(run(current, "draft.ban", { team, champion: null })).state;
			continue;
		}
		const champion = wanted[side][next[side]++];
		current = ok(run(current, "draft.pick", { team, champion })).state;
	}
	for (const side of ["blue", "red"] as const) {
		const [top, jungle, mid, bot, support] = wanted[side];
		current = ok(
			run(current, "draft.roles", {
				team: team(side),
				roles: { top, jungle, mid, bot, support },
			}),
		).state;
	}
	return current;
}
