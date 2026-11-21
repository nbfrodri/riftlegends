import type {
	AiContent,
	MatchContent,
	MatchEvent,
	Role,
	Side,
} from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { type Lineup, type Profile, profiles } from "./profile";

export interface MatchSetup {
	/** Root seed of the series (plan 05). */
	readonly seed: number;
	readonly game: number;
	readonly draft: AiContent;
	readonly match: MatchContent;
	readonly blue: Lineup;
	readonly red: Lineup;
}

interface SideContext {
	readonly team: string;
	readonly profile: Profile;
	/** Player id in each role. */
	readonly players: Readonly<Record<Role, string>>;
}

/** What stays fixed during a game. */
interface MatchContext {
	readonly seed: number;
	readonly game: number;
	readonly rules: MatchContent["rules"];
	readonly blue: SideContext;
	readonly red: SideContext;
}

interface SideState {
	readonly gold: number;
	readonly kills: number;
}

export interface MatchState {
	readonly context: MatchContext;
	/** The last minute played; 0 before the game starts. */
	readonly minute: number;
	readonly blue: SideState;
	readonly red: SideState;
	readonly winner: Side | null;
}

export const other = (side: Side): Side => (side === "blue" ? "red" : "blue");

function players(draft: AiContent, team: string) {
	const roster = indexContent(draft).rosters.get(team);
	const id = (role: Role) => {
		const player = roster?.get(role);
		if (!player) throw new Error(`No player for ${team} in ${role}`);
		return player.id;
	};
	return {
		top: id("top"),
		jungle: id("jungle"),
		mid: id("mid"),
		bot: id("bot"),
		support: id("support"),
	};
}

export function createMatch(setup: MatchSetup): MatchState {
	const { us, them } = profiles(
		setup.draft,
		setup.match,
		setup.blue,
		setup.red,
	);
	const side = (lineup: Lineup, profile: Profile): SideContext => ({
		team: lineup.team,
		profile,
		players: players(setup.draft, lineup.team),
	});
	const start: SideState = { gold: 0, kills: 0 };
	return {
		context: {
			seed: setup.seed,
			game: setup.game,
			rules: setup.match.rules,
			blue: side(setup.blue, us),
			red: side(setup.red, them),
		},
		minute: 0,
		blue: start,
		red: start,
		winner: null,
	};
}

/** Adds what the events of a minute earned to each side. */
export function applyEvents(
	state: MatchState,
	events: readonly MatchEvent[],
): MatchState {
	const earn = (side: Side): SideState =>
		events.reduce(
			(acc, e) => ({
				gold: acc.gold + e.gold[side],
				kills: acc.kills + (e.side === side ? e.kills.length : 0),
			}),
			state[side],
		);
	const nexus = events.find((e) => e.kind === "nexus");
	return {
		...state,
		blue: earn("blue"),
		red: earn("red"),
		winner: nexus ? nexus.side : state.winner,
	};
}
