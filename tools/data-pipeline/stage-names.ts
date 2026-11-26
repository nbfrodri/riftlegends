import type { Competition } from "@rift-legends/contracts/competition-format";
import type { LeagueId } from "./league-formats.ts";

type StageName = NonNullable<Competition["stages"][number]["name"]>;
type Split = NonNullable<StageName["split"]>;
type NamesByStage = Readonly<Record<string, string>>;
const splits = ["winter", "spring", "summer"] as const;

const leagueNames: Record<LeagueId, Record<Split, NamesByStage>> = {
	LCK: {
		winter: {
			"cup-groups": "groups",
			"cup-playin-r1-1": "playInRound1Match1",
			"cup-playin-r1-2": "playInRound1Match2",
			"cup-playin-r2-1": "playInRound2Match1",
			"cup-playin-r2-2": "playInRound2Match2",
			"cup-playin-r3": "playInRound3",
			"cup-playoffs": "playoffs",
		},
		spring: {
			"rounds-1-2": "rounds1And2",
			"road-to-msi": "roadToMsi",
		},
		summer: {
			"rounds-3-4": "rounds3And4",
			"season-playin-r1-1": "playInRound1Match1",
			"season-playin-r1-2": "playInRound1Match2",
			"season-playin-r2": "playInRound2",
			"season-playoffs": "playoffs",
		},
	},
	LPL: {
		winter: {
			"split-1-high": "upperGroup",
			"split-1-mid": "middleGroup",
			"split-1-low": "lowerGroup",
			"split-1-ladder-a": "playInGroupA",
			"split-1-ladder-b": "playInGroupB",
			"split-1-playoffs": "playoffs",
		},
		spring: {
			"split-2-high": "upperGroup",
			"split-2-low": "lowerGroup",
			"split-2-playin-1": "playInMatch1",
			"split-2-playin-2": "playInMatch2",
			"split-2-playin-3": "playInMatch3",
			"split-2-playin-4": "playInMatch4",
			"split-2-playoffs": "playoffs",
		},
		summer: {
			"split-3-high": "upperGroup",
			"split-3-low": "lowerGroup",
			"knights-road-1": "knightsRoadMatch1",
			"knights-road-2": "knightsRoadMatch2",
			"grand-finals": "grandFinals",
		},
	},
	LEC: {
		winter: { versus: "regularSeason", "versus-playoffs": "playoffs" },
		spring: { spring: "regularSeason", "spring-playoffs": "playoffs" },
		summer: { summer: "regularSeason", "summer-playoffs": "playoffs" },
	},
	LCP: {
		winter: { "split-1": "regularSeason", "split-1-playoffs": "playoffs" },
		spring: { "split-2": "regularSeason", "split-2-playoffs": "playoffs" },
		summer: {
			"split-3-swiss": "swiss",
			"split-3-seed-high": "upperSeeding",
			"split-3-seed-low": "lowerSeeding",
			"split-3-seed-final": "finalSeeding",
			"split-3-playoffs": "playoffs",
		},
	},
	LCS: {
		winter: {
			"lock-in-swiss": "swiss",
			"lock-in-last-chance": "lastChance",
			"lock-in-playoffs": "playoffs",
		},
		spring: { spring: "regularSeason", "spring-playoffs": "playoffs" },
		summer: { summer: "regularSeason", "summer-playoffs": "playoffs" },
	},
	CBLOL: {
		winter: {
			cup: "regularSeason",
			"cup-playin-1": "playInRound1Match1",
			"cup-playin-2": "playInRound1Match2",
			"cup-last-chance": "lastChance",
			"cup-playoffs": "playoffs",
		},
		spring: { "split-1": "regularSeason", "split-1-playoffs": "playoffs" },
		summer: { "split-2": "regularSeason", "split-2-playoffs": "playoffs" },
	},
};

export function leagueStageName(league: LeagueId, id: string): StageName {
	for (const split of splits) {
		const names = leagueNames[league][split];
		const stage = names[id];
		if (Object.hasOwn(names, id) && stage) return { split, stage };
	}
	throw new Error(`No name for league stage ${league}/${id}`);
}

const internationalNames: NamesByStage = {
	groupA: "groupA",
	groupB: "groupB",
	knockout: "knockout",
	playin: "playIn",
	bracket: "bracket",
	swiss: "swiss",
};

export function internationalStageName(id: string): StageName {
	const stage = internationalNames[id];
	if (!Object.hasOwn(internationalNames, id) || !stage)
		throw new Error(`No name for international stage ${id}`);
	return { stage };
}
