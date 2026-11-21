import { aiContent } from "@rift-legends/contracts";
import { champions, identities, matchups, players, synergies } from "./data";

export const packagedDraftContent = aiContent.parse({
	champions: champions.map(
		({ cc: _cc, mobility: _mobility, frontline: _frontline, ...draft }) =>
			draft,
	),
	matchups,
	synergies,
	identities,
	players: players.map(
		({
			attributes: _attributes,
			leader: _leader,
			mastery: _mastery,
			...draft
		}) => draft,
	),
});
