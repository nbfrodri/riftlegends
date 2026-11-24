import type { Personality } from "@rift-legends/contracts";
import { loadRealContent } from "../content/real";
import cblol from "../content/real/cblol.json";
import lck from "../content/real/lck.json";
import lcp from "../content/real/lcp.json";
import lcs from "../content/real/lcs.json";
import lec from "../content/real/lec.json";
import lpl from "../content/real/lpl.json";
import teams from "../content/real/teams.json";
import { type BankGame, type ProDraft, proDrafts } from "./bank";

const LEAGUES: Record<string, { games: readonly BankGame[] }> = {
	CBLOL: cblol as never,
	LCK: lck as never,
	LCP: lcp as never,
	LCS: lcs as never,
	LEC: lec as never,
	LPL: lpl as never,
};

const personalities = new Map(
	teams.map((t) => [t.id, t.coach.personality as Personality]),
);

/** Personality of a team's coach in the real content; unknown teams play balanced. */
export const personalityOf = (team: string): Personality =>
	personalities.get(team) ?? "balanced";

/**
 * Every pro draft of the packaged snapshot between two teams of the real
 * content (the AI needs their rosters), in league and game order.
 */
export function realBank(): ProDraft[] {
	return Object.entries(LEAGUES).flatMap(([league, { games }]) =>
		proDrafts(league, games).filter(
			(d) => personalities.has(d.blue) && personalities.has(d.red),
		),
	);
}

export const realContent = () => loadRealContent().draft;
