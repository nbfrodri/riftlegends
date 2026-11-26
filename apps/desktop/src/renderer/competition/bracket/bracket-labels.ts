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
	/** Short code for the pending slots it feeds («SF1», «U1-2», «LF»), the same in every language. */
	code: string;
}

const CODES: Record<RoundKey, string> = {
	final: "F",
	semifinal: "SF",
	quarterfinal: "QF",
	round: "R",
	upperFinal: "UF",
	upperRound: "U",
	lowerFinal: "LF",
	lowerRound: "L",
	grandFinal: "GF",
	reset: "GF",
};

function codeOf(round: Label, index: number | null) {
	const key = round.key.slice(KEY.length + 1) as RoundKey;
	const base = `${CODES[key]}${round.params.n ?? ""}`;
	if (index === null) return base;
	return /\d$/.test(base) ? `${base}-${index}` : `${base}${index}`;
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
			const round = roundOf(match, upperRounds, lowerRounds, double);
			const index = group.length > 1 ? group.indexOf(match) + 1 : null;
			return [match.id, { round, index, code: codeOf(round, index) }];
		}),
	);
}

type Slot = Match["from"][number];
type Translate = (
	key:
		| Label["key"]
		| `competition.bracket.${"numbered" | "seed" | `${"winner" | "loser"}${"Of" | "Short"}`}`,
	params: Record<string, string | number>,
) => string;

/** The full name of a series: its round, numbered when the round has more than one. */
export function matchName(
	t: Translate,
	labels: ReadonlyMap<string, MatchLabel>,
	id: string,
) {
	const label = labels.get(id);
	if (!label) return id;
	const round = t(label.round.key, label.round.params);
	return label.index === null
		? round
		: t("competition.bracket.numbered", { round, n: label.index });
}

/** Where a team not yet known comes from: a seed, or the winner or loser of a series. */
export function originText(
	t: Translate,
	labels: ReadonlyMap<string, MatchLabel>,
	slot: Slot,
	short: boolean,
) {
	if (slot.kind === "seed")
		return t("competition.bracket.seed", { n: slot.rank });
	return short
		? t(`competition.bracket.${slot.kind}Short`, {
				match: labels.get(slot.match)?.code ?? slot.match,
			})
		: t(`competition.bracket.${slot.kind}Of`, {
				match: matchName(t, labels, slot.match),
			});
}
