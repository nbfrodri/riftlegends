import type { BracketView } from "@rift-legends/contracts";

// Names of the rounds of a bracket, as i18n keys with their parameters.

type Match = BracketView["matches"][number];

type RoundKey =
	| "final"
	| "semifinal"
	| "quarterfinal"
	| "round"
	| "upperFinal"
	| "upperRound"
	| "lowerFinal"
	| "lowerRound"
	| "grandFinal"
	| "reset";

export interface Label {
	key: `competition.bracket.round.${RoundKey}`;
	params: Record<string, number>;
}

export interface MatchLabel {
	/** The round, shared by every series in it («Semifinal»). */
	round: Label;
	/** 1-based place of the series in its round, when the round has more than one. */
	index: number | null;
}

const KEY = "competition.bracket.round" as const;

function roundOf(
	match: Match,
	upperRounds: number,
	lowerRounds: number,
	double: boolean,
): Label {
	const n = match.round;
	if (match.side === "final") return { key: `${KEY}.grandFinal`, params: {} };
	if (match.side === "reset") return { key: `${KEY}.reset`, params: {} };
	if (match.side === "lower")
		return n === lowerRounds
			? { key: `${KEY}.lowerFinal`, params: {} }
			: { key: `${KEY}.lowerRound`, params: { n } };
	if (double)
		return n === upperRounds
			? { key: `${KEY}.upperFinal`, params: {} }
			: { key: `${KEY}.upperRound`, params: { n } };
	const fromEnd = upperRounds - n;
	if (fromEnd === 0) return { key: `${KEY}.final`, params: {} };
	if (fromEnd === 1) return { key: `${KEY}.semifinal`, params: {} };
	if (fromEnd === 2) return { key: `${KEY}.quarterfinal`, params: {} };
	return { key: `${KEY}.round`, params: { n } };
}

/** The label of every series of the bracket, by id. */
export function bracketLabels(
	matches: readonly Match[],
): Map<string, MatchLabel> {
	const last = (side: Match["side"]) =>
		Math.max(0, ...matches.filter((m) => m.side === side).map((m) => m.round));
	const upperRounds = last("upper");
	const lowerRounds = last("lower");
	const double = lowerRounds > 0;
	const groups = new Map<string, Match[]>();
	for (const match of matches) {
		const key = `${match.side}-${match.round}`;
		groups.set(key, [...(groups.get(key) ?? []), match]);
	}
	return new Map(
		matches.map((match) => {
			const group = groups.get(`${match.side}-${match.round}`) ?? [];
			return [
				match.id,
				{
					round: roundOf(match, upperRounds, lowerRounds, double),
					index: group.length > 1 ? group.indexOf(match) + 1 : null,
				},
			];
		}),
	);
}
