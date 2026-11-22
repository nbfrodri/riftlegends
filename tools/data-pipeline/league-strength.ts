// Design priors, editable independently of the formulas. LCK and LPL lead
// because of their sustained international results and depth. LEC is the
// reference. LCP and LCS sit just below it; CBLOL has less international depth.

/** Points added to every attribute of a player in the league. */
export const leagueOffset: Readonly<Record<string, number>> = {
	LCK: 4,
	LPL: 3,
	LEC: 0,
	LCP: -2,
	LCS: -3,
	CBLOL: -6,
};

/**
 * Elo-like starting rating of the league average team, used for the global
 * seed. The gaps are large on purpose: a dominant team of a weaker league
 * (+240 inside it) should not outrank the best of the LCK or LPL.
 */
export const leagueRating: Readonly<Record<string, number>> = {
	LCK: 150,
	LPL: 120,
	LEC: 0,
	LCP: -80,
	LCS: -110,
	CBLOL: -190,
};

/** Elo-like points of a (smoothed) win rate: 400·log10(w / (1 − w)). */
export const eloOf = (winRate: number) =>
	400 * Math.log10(winRate / (1 - winRate));
