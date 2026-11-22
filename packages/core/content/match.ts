import { matchContent } from "@rift-legends/contracts";
import { champions, players, rules, teams } from "./data";

export const packagedMatchContent = matchContent.parse({
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
