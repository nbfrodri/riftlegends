import type {
	AiContent,
	MatchContent,
	MatchEvent,
	Role,
	Side,
} from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { type Fixed, mul, SCALE, toInt } from "../math";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { MentalEdge } from "./mental";
import { type Lineup, type Profile, profiles } from "./profile";

/** Minutes each buff lasts after its objective falls. */
const BUFF_MINUTES = { herald: 2, baron: 3, elder: 2 } as const;
/** Range of the form of the day, in points (F10 tunes it). */
const FORM = 600_000;

export interface MatchSetup {
	/** Root seed of the series (plan 05). */
	readonly seed: number;
	readonly game: number;
	readonly draft: AiContent;
	readonly match: MatchContent;
	readonly blue: Lineup;
	readonly red: Lineup;
	/** Mental and series edge of each side (F6–F12); none in a lone game. */
	readonly mental?: Readonly<Record<Side, MentalEdge>>;
}

interface SideContext {
	readonly team: string;
	readonly strategy: MatchContent["teams"][number]["strategy"];
	readonly profile: Profile;
	readonly aggression: number;
	readonly positioning: number;
	/** How the team plays today, in points; one draw per game. */
	readonly form: number;
	readonly mental: MentalEdge | null;
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

export type Lane = "top" | "mid" | "bot";
export const LANES: readonly Lane[] = ["top", "mid", "bot"];
type Objective = "dragon" | "herald" | "baron" | "elder";

/** A side's dragons that complete its soul and end the dragons. */
export const SOUL = 4;

interface SideState {
	readonly gold: number;
	readonly kills: number;
	readonly dragons: number;
	/** Towers this side has lost in each lane (0–3) and at its nexus (0–2). */
	readonly towers: Readonly<Record<Lane, number>>;
	readonly nexusTowers: number;
	/** Minute the side can press its advantage after a fight. */
	readonly fightPushAt: number;
	/** Minute each lost inhibitor is back; it is down while that is later. */
	readonly inhibitors: Readonly<Record<Lane, number>>;
	/** Minute each buff wears off; 0 if the side never had it. */
	readonly buffs: Readonly<Record<keyof typeof BUFF_MINUTES, number>>;
}

export interface MatchState {
	readonly context: MatchContext;
	/** The last minute played; 0 before the game starts. */
	readonly minute: number;
	readonly blue: SideState;
	readonly red: SideState;
	/** Minute from which each objective can be taken. */
	readonly objectives: Readonly<Record<Objective, number>>;
	readonly winner: Side | null;
}

/** The minute in which `seconds` falls: an objective at 5:00 is up in minute 5. */
export const minuteOf = (seconds: number) =>
	(seconds + 59 - ((seconds + 59) % 60)) / 60;

export const inhibitorDown = (side: SideState, minute: number) =>
	LANES.some((lane) => side.inhibitors[lane] > minute);

export const other = (side: Side): Side => (side === "blue" ? "red" : "blue");

function strategy(match: MatchContent, team: string) {
	const found = match.teams.find((t) => t.id === team);
	if (!found) throw new Error(`No match data for team ${team}`);
	return found.strategy;
}

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
	// No contest plays minute 0: the form of the day has that stream.
	const rng = createRng(deriveSeed(setup.seed, SCOPES.match, setup.game, 0, 0));
	const side = (lineup: Lineup, profile: Profile, which: Side): SideContext => {
		const mental = setup.mental?.[which] ?? null;
		// Consistency widens or narrows the form (F10); 10,000 is normal.
		const form = mul(
			int(rng, -FORM, FORM) as Fixed,
			(mental?.variance ?? SCALE) as Fixed,
		);
		const ids = players(setup.draft, lineup.team);
		const roster = Object.values(ids).map((id) => {
			const player = setup.match.players.find((p) => p.id === id);
			if (!player) throw new Error(`No match data for player ${id}`);
			return player.attributes;
		});
		const average = (key: "aggression" | "positioning") =>
			toInt(
				((roster.reduce((sum, p) => sum + p[key], 0) * SCALE) /
					roster.length) as Fixed,
			);
		return {
			team: lineup.team,
			form,
			mental,
			strategy: strategy(setup.match, lineup.team),
			profile,
			players: ids,
			aggression: average("aggression"),
			positioning: average("positioning"),
		};
	};
	const start: SideState = {
		gold: 0,
		kills: 0,
		dragons: 0,
		towers: { top: 0, mid: 0, bot: 0 },
		nexusTowers: 0,
		fightPushAt: 0,
		inhibitors: { top: 0, mid: 0, bot: 0 },
		buffs: { herald: 0, baron: 0, elder: 0 },
	};
	const { objectives } = setup.match.rules;
	return {
		context: {
			seed: setup.seed,
			game: setup.game,
			rules: setup.match.rules,
			blue: side(setup.blue, us, "blue"),
			red: side(setup.red, them, "red"),
		},
		minute: 0,
		blue: start,
		red: start,
		objectives: {
			dragon: minuteOf(objectives.dragon.first),
			herald: minuteOf(objectives.herald.first),
			baron: minuteOf(objectives.baron.first),
			elder: minuteOf(objectives.elder.first),
		},
		winner: null,
	};
}

const lane = (event: MatchEvent) => event.zone.slice("lane-".length) as Lane;

/** One event's mark on the side that won it and on the other side. */
function mark(state: MatchState, e: MatchEvent): MatchState {
	const { rules } = state.context;
	const winner = state[e.side];
	const loserSide = other(e.side);
	const loser = state[loserSide];
	let loserKills = 0;
	if (e.kind === "fight") {
		const loserPlayers = Object.values(state.context[loserSide].players);
		loserKills = e.kills.filter((kill) =>
			loserPlayers.includes(kill.killer),
		).length;
	}
	let won: SideState = {
		...winner,
		gold: winner.gold + e.gold[e.side],
		kills: winner.kills + e.kills.length - loserKills,
	};
	let lost: SideState = {
		...loser,
		gold: loser.gold + e.gold[loserSide],
		kills: loser.kills + loserKills,
	};
	let objectives = state.objectives;
	const respawn = (kind: Objective) => ({
		...objectives,
		[kind]: e.minute + minuteOf(rules.objectives[kind].respawn),
	});
	const buff = (kind: keyof typeof BUFF_MINUTES) => ({
		...won.buffs,
		[kind]: e.minute + BUFF_MINUTES[kind],
	});
	switch (e.kind) {
		case "fight":
			won = { ...won, fightPushAt: e.minute + 1 };
			break;
		case "tower":
			lost =
				e.tier === 4
					? { ...lost, nexusTowers: lost.nexusTowers + 1 }
					: {
							...lost,
							towers: { ...lost.towers, [lane(e)]: lost.towers[lane(e)] + 1 },
						};
			break;
		case "inhibitor":
			lost = {
				...lost,
				inhibitors: {
					...lost.inhibitors,
					[lane(e)]: e.minute + minuteOf(rules.inhibitorRespawn),
				},
			};
			break;
		case "dragon":
			won = { ...won, dragons: won.dragons + 1 };
			objectives = respawn("dragon");
			break;
		case "herald":
		case "baron":
		case "elder":
			won = { ...won, buffs: buff(e.kind) };
			objectives = respawn(e.kind);
			break;
	}
	return {
		...state,
		[e.side]: won,
		[loserSide]: lost,
		objectives,
		winner: e.kind === "nexus" ? e.side : state.winner,
	};
}

/** Applies the events of a minute, in order. */
export function applyEvents(
	state: MatchState,
	events: readonly MatchEvent[],
): MatchState {
	return events.reduce(mark, state);
}
