import {
	type AiContent,
	type MatchContent,
	type MatchEvent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { indexContent } from "../ai/content-index";
import { type Fixed, mul, SCALE, toInt } from "../math";
import { int } from "../rng/helpers";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { roleWeights } from "./attribution/weights";
import { markEconomy, type SideEconomy, type Slot } from "./economy";
import { type MatchPlays, startPlays } from "./events";
import { markStructure, type SideMap } from "./map-state";
import type { MentalEdge } from "./mental";
import {
	markObjective,
	type ObjectiveTimers,
	type SideObjectives,
	startObjectives,
} from "./objective-state";
import { type Lineup, type Profile, profiles } from "./profile";

export { earnPassive } from "./economy";
export { inhibitorDown, LANES, type Lane } from "./map-state";
export { GRUBS, minuteOf, SOUL } from "./objective-state";

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
	/** The `vision` attribute of each role's player (issue #499). */
	readonly vision: Readonly<Record<Role, number>>;
	/** Mechanics and objective control of the jungler, combined for Smite. */
	readonly smite: number;
	/** Weight of each role to score and to assist a kill (issue #346). */
	readonly attribution: Readonly<
		Record<Role, { kill: number; assist: number }>
	>;
}

/** What stays fixed during a game. */
interface MatchContext {
	readonly seed: number;
	readonly game: number;
	readonly rules: MatchContent["rules"];
	readonly blue: SideContext;
	readonly red: SideContext;
	/** Side and role of each player, to pay the gold of an event. */
	readonly slots: ReadonlyMap<string, Slot>;
}

type SideState = SideEconomy & SideObjectives & SideMap;

export interface MatchState {
	readonly context: MatchContext;
	/** The last minute played; 0 before the game starts. */
	readonly minute: number;
	readonly blue: SideState;
	readonly red: SideState;
	/** Minute from which each objective can be taken. */
	readonly objectives: ObjectiveTimers;
	readonly winner: Side | null;
	readonly plays: MatchPlays;
}

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
		const { champions } = indexContent(setup.draft);
		const roster = ROLES.map((role) => {
			const id = ids[role];
			const player = setup.match.players.find((p) => p.id === id);
			if (!player) throw new Error(`No match data for player ${id}`);
			return player.attributes;
		});
		const jungler = roster[ROLES.indexOf("jungle")];
		if (!jungler) throw new Error(`No jungler for ${lineup.team}`);
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
			smite: jungler.mechanics + jungler.objectiveControl,
			vision: Object.fromEntries(
				ROLES.map((role, i) => [
					role,
					(roster[i] as { vision: number }).vision,
				]),
			) as SideContext["vision"],
			attribution: Object.fromEntries(
				ROLES.map((role, i) => [
					role,
					roleWeights(
						role,
						champions.get(lineup.roles[role])?.archetypes ?? [],
						roster[i] as (typeof roster)[number],
					),
				]),
			) as SideContext["attribution"],
			aggression: average("aggression"),
			positioning: average("positioning"),
		};
	};
	const start: SideState = {
		gold: 0,
		paid: ROLES.map(() => 0),
		kills: 0,
		dragons: 0,
		grubs: 0,
		heralds: 0,
		barons: 0,
		elders: 0,
		towers: { top: 0, mid: 0, bot: 0 },
		nexusTowers: 0,
		fightPushAt: 0,
		inhibitors: { top: 0, mid: 0, bot: 0 },
		buffs: { herald: 0, baron: 0, elder: 0 },
	};
	const { objectives } = setup.match.rules;
	const blue = side(setup.blue, us, "blue");
	const red = side(setup.red, them, "red");
	const slots = new Map<string, Slot>();
	for (const [which, team] of [
		["blue", blue],
		["red", red],
	] as const) {
		ROLES.forEach((role, index) => {
			slots.set(team.players[role], { side: which, index });
		});
	}
	return {
		context: {
			seed: setup.seed,
			game: setup.game,
			rules: setup.match.rules,
			blue,
			red,
			slots,
		},
		minute: 0,
		blue: start,
		red: start,
		objectives: startObjectives(objectives),
		winner: null,
		plays: startPlays(),
	};
}

/** One event's mark on the side that won it and on the other side. */
function mark(state: MatchState, e: MatchEvent): MatchState {
	const { rules } = state.context;
	const loserSide = other(e.side);
	let { won, lost } = markEconomy(state, e, loserSide);
	let objectives = state.objectives;
	switch (e.kind) {
		case "fight":
			won = { ...won, fightPushAt: e.minute + 1 };
			break;
		case "tower":
		case "inhibitor":
			lost = markStructure(lost, e, rules.inhibitorRespawn);
			break;
		case "grub":
		case "dragon":
		case "herald":
		case "baron":
		case "elder":
			({ won, lost, objectives } = markObjective(
				won,
				lost,
				objectives,
				e,
				loserSide,
				rules.objectives,
			));
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
