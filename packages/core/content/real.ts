import {
	type AiContent,
	aiContent,
	type MatchContent,
	matchContent,
} from "@rift-legends/contracts";
import { contentVersionOf } from "../version";
import { identities, rules } from "./data";
import champions from "./real/champions/champions.json";
import counters from "./real/champions/counters.json";
import matchups from "./real/champions/matchups.json";
import provenance from "./real/champions/provenance.json";
import synergies from "./real/champions/synergies.json";
import players from "./real/players.json";
import teams from "./real/teams.json";

export interface PackagedContent {
	readonly season: number;
	readonly draft: AiContent;
	readonly match: MatchContent;
	/** Content version of this set, as `CONTENT_VERSION` is of the fictional one. */
	readonly version: number;
}

/**
 * The real LoL content of plan 11: the Leaguepedia snapshot of the six top
 * leagues with the champions derived from it. Team plans and game rules are
 * shared with the fictional set. Champion names repeat their ids: the UI takes
 * the real names from the asset cache (R4).
 */
function load(): PackagedContent {
	const source = { champions, matchups, counters, synergies, players, teams };
	const draft = aiContent.parse({
		champions: champions.map(
			({ cc: _cc, mobility: _mobility, frontline: _frontline, ...rest }) =>
				rest,
		),
		matchups,
		counters,
		synergies,
		identities,
		players: players.map(
			({
				attributes: _attributes,
				leader: _leader,
				mastery: _mastery,
				...rest
			}) => rest,
		),
	});
	const match = matchContent.parse({
		players: players.map(({ id, attributes, leader, mastery }) => ({
			id,
			attributes,
			leader,
			mastery,
		})),
		teams,
		champions: champions.map(({ id, cc, mobility, frontline }) => ({
			id,
			cc,
			mobility,
			frontline,
		})),
		rules,
	});
	return {
		draft,
		match,
		version: contentVersionOf(source),
		season: provenance.tierSeasons.current,
	};
}

let loaded: PackagedContent | undefined;

/** Parsed on first use, so sessions that only play fictional content never pay for it. */
export const loadRealContent = (): PackagedContent => {
	loaded ??= load();
	return loaded;
};
