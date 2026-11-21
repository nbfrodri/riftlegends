import { z } from "zod";
import { defineCommands, defineQueries, position } from "../envelope";
import { defineFacts } from "../facts";
import { aiDecidedFact, aiPerTeam } from "./ai";
import { matchEndedFact, matchEventFact, matchStartedFact } from "./match";

export * from "./ai";
export * from "./match";

// Catalog of plan 06: draft rules and fearless series.

const id = z.string().min(1).max(64);
const teamId = id;
const championId = id;

const SIDES = ["blue", "red"] as const;
export const ROLES = ["top", "jungle", "mid", "bot", "support"] as const;
const FORMATS = ["bo1", "bo3", "bo5"] as const;
const FEARLESS = ["hard", "soft", "off"] as const;
const PHASES = [
	"side",
	"bans1",
	"picks1",
	"bans2",
	"picks2",
	"roles",
	"result",
	"over",
] as const;

const side = z.enum(SIDES);
const uint32 = z
	.int()
	.min(0)
	.max(2 ** 32 - 1);
const unique = <T>(list: readonly T[]) => new Set(list).size === list.length;
const pair = <T extends z.ZodType>(item: T) => z.tuple([item, item]);

/** Champion of each role; every role once. */
const roleAssignment = z.strictObject({
	top: championId,
	jungle: championId,
	mid: championId,
	bot: championId,
	support: championId,
});

export const draftCommands = defineCommands({
	"series.start": z.strictObject({
		teams: pair(teamId).refine(unique, "teams must differ"),
		/** Lower is better; without seeds game 1's side is drawn. */
		seeds: pair(position).optional(),
		format: z.enum(FORMATS),
		fearless: z.enum(FEARLESS),
		timer: z.boolean(),
		pool: z.array(championId).refine(unique, "pool repeats a champion"),
		/** Root seed of the series' RNG (plan 05). */
		seed: uint32,
		/** Which teams the AI plays (plan 07). */
		ai: aiPerTeam.optional(),
	}),
	"side.choose": z.strictObject({ team: teamId, side }),
	"draft.ban": z.strictObject({
		team: teamId,
		champion: championId.nullable(),
	}),
	"draft.pick": z.strictObject({ team: teamId, champion: championId }),
	"draft.timeout": z.strictObject({}),
	/** The AI of the team whose turn it is acts (plan 07). */
	"draft.ai": z.strictObject({}),
	"draft.roles": z.strictObject({ team: teamId, roles: roleAssignment }),
	/** Provisional until the match simulation (plan 08) decides the winner. */
	"game.finish": z.strictObject({ winner: teamId }),
	/** Plays the game after the roles (plan 08). */
	"match.play": z.strictObject({}),
});

export const draftQueries = defineQueries({
	/** `team` is who looks: with soft fearless, availability depends on it. */
	"draft.view": z.strictObject({ team: teamId.optional() }),
});

export const draftFacts = defineFacts({
	"series.started": {
		teams: pair(teamId),
		format: z.enum(FORMATS),
		fearless: z.enum(FEARLESS),
		timer: z.boolean(),
		pool: z.array(championId),
		seed: uint32,
		ai: aiPerTeam.optional(),
	},
	"side.chosen": {
		game: position,
		team: teamId,
		side,
		by: z.enum(["seed", "draw", "choice"]),
	},
	"game.started": { game: position, blue: teamId, red: teamId },
	"draft.banned": {
		game: position,
		team: teamId,
		champion: championId.nullable(),
		timeout: z.boolean(),
	},
	"draft.picked": {
		game: position,
		team: teamId,
		champion: championId,
		timeout: z.boolean(),
	},
	"ai.decided": aiDecidedFact,
	"draft.rolesAssigned": {
		game: position,
		team: teamId,
		roles: roleAssignment,
	},
	"match.started": matchStartedFact,
	"match.event": matchEventFact,
	"match.ended": matchEndedFact,
	"game.finished": { game: position, winner: teamId },
	/** `wins` follows the order of `series.started` teams. */
	"series.finished": { winner: teamId, wins: pair(position) },
});

const sideView = z.strictObject({
	team: teamId,
	bans: z.array(championId.nullable()),
	picks: z.array(championId),
});

/** What `draft.view` answers. */
export const draftView = z.strictObject({
	game: position,
	wins: pair(position),
	phase: z.enum(PHASES),
	/** Who acts next; a side is chosen before the teams have one. */
	turn: z
		.union([
			z.strictObject({
				team: teamId,
				side,
				action: z.enum(["ban", "pick", "roles"]),
			}),
			z.strictObject({ team: teamId, action: z.literal("side") }),
		])
		.nullable(),
	blue: sideView,
	red: sideView,
	availability: z.array(
		z.discriminatedUnion("status", [
			z.strictObject({ champion: championId, status: z.literal("free") }),
			z.strictObject({ champion: championId, status: z.literal("banned") }),
			z.strictObject({
				champion: championId,
				status: z.enum(["picked", "fearless"]),
				team: teamId,
			}),
		]),
	),
});

export type DraftView = z.infer<typeof draftView>;
export type Role = (typeof ROLES)[number];
export type Side = (typeof SIDES)[number];
