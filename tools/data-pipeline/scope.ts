export interface LeagueScope {
	id: string;
	name: string;
	/** Main tournaments of the snapshot season, found by `season.ts`. */
	pages: readonly string[];
	/**
	 * Tournaments of the season before. Present only while the league has few
	 * games this season (see `mixLeagueGames`); they feed the attributes only.
	 */
	previousPages?: readonly string[];
}

/** Seasons before the snapshot season that feed the career history. */
export const historySpan = 7;

/** The six leagues of the snapshot, with their Leaguepedia `League` name. */
export const leagues = [
	{ id: "LCK", name: "LoL Champions Korea" },
	{ id: "LPL", name: "Tencent LoL Pro League" },
	{ id: "LEC", name: "LoL EMEA Championship" },
	{ id: "LCP", name: "League of Legends Championship Pacific" },
	{ id: "LCS", name: "League of Legends Championship Series" },
	{ id: "CBLOL", name: "Circuit Brazilian League of Legends" },
] as const;

export const dataDragonVersion = "16.23.1";
export const dataDragonUrl = `https://ddragon.leagueoflegends.com/cdn/${dataDragonVersion}/data/en_US/champion.json`;
