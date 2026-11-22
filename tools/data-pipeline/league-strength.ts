// Design priors, editable independently of the formulas. LCK and LPL lead
// because of their sustained international results and depth. LEC is the
// reference. LCP and LCS sit just below it; CBLOL has less international depth.
export const leagueStrength: Readonly<Record<string, number>> = {
	LCK: 1.08,
	LPL: 1.06,
	LEC: 1,
	LCP: 0.98,
	LCS: 0.96,
	CBLOL: 0.9,
};
