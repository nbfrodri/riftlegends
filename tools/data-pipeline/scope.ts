export interface LeagueScope {
	id: string;
	name: string;
	pages: readonly string[];
}

/** Season the snapshot covers. Rolling it forward moves the old one into the career history. */
export const snapshotSeason = 2026;
/** Seasons before `snapshotSeason` that feed the career history. */
export const historySpan = 7;

// Main competition only. Excludes showmatches, the 2025 promotions, LCK Season
// Opening and LPL Regional Finals. See docs/research/leaguepedia-2026-11.md.
const leagues = [
	[
		"LCK",
		"LoL Champions Korea",
		[
			"Cup",
			"Rounds 1-2",
			"Road to MSI",
			"Rounds 3-4",
			"Season Play-In",
			"Season Playoffs",
		],
	],
	[
		"LPL",
		"Tencent LoL Pro League",
		[
			"Split 1",
			"Split 1 Playoffs",
			"Split 2",
			"Split 2 Playoffs",
			"Split 3",
			"Grand Finals",
		],
	],
	[
		"LEC",
		"LoL EMEA Championship",
		[
			"Versus Season",
			"Versus Playoffs",
			"Spring Season",
			"Spring Playoffs",
			"Summer Season",
			"Summer Playoffs",
		],
	],
	[
		"LCP",
		"League of Legends Championship Pacific",
		["Split 1", "Split 1 Playoffs", "Split 2", "Split 2 Playoffs", "Split 3"],
	],
	[
		"LCS",
		"League of Legends Championship Series",
		[
			"Lock-In",
			"Spring Season",
			"Spring Playoffs",
			"Summer Season",
			"Summer Playoffs",
		],
	],
	[
		"CBLOL",
		"Circuit Brazilian League of Legends",
		["Cup", "Split 1", "Split 1 Playoffs", "Split 2", "Split 2 Playoffs"],
	],
] as const;

export const season2026: readonly LeagueScope[] = leagues.map(
	([id, name, suffixes]) => ({
		id,
		name,
		pages: suffixes.map((suffix) => `${id}/${snapshotSeason} Season/${suffix}`),
	}),
);

export const dataDragonVersion = "16.23.1";
export const dataDragonUrl = `https://ddragon.leagueoflegends.com/cdn/${dataDragonVersion}/data/en_US/champion.json`;
