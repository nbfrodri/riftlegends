import { fictionalContent } from "../../ai/fixtures/content";
import type { Lineup } from "../profile";
import type { MatchSetup } from "../state";
import { fictionalMatchContent } from "./content";

const forge: Lineup = {
	team: "forge",
	roles: {
		top: "cragbell",
		jungle: "duskroot",
		mid: "glasswake",
		bot: "copperfin",
		support: "bronzehook",
	},
};

const shoal: Lineup = {
	team: "shoal",
	roles: {
		top: "saltspire",
		jungle: "coalstride",
		mid: "waxblade",
		bot: "suncord",
		support: "shellward",
	},
};

/** Game 1 of forge (blue) against shoal (red) on the fictional content. */
export const matchSetup = (change: Partial<MatchSetup> = {}): MatchSetup => ({
	seed: 42,
	game: 1,
	draft: fictionalContent,
	match: fictionalMatchContent,
	blue: forge,
	red: shoal,
	...change,
});
