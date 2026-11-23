import { z } from "zod";
import { defineCommands, defineQueries, position } from "../envelope";
import { defineFacts } from "../facts";
import {
	aiContent,
	aiDecidedFact,
	aiPerTeam,
	aiSideDecidedFact,
	TIERS,
} from "./ai";
import {
	matchContent,
	matchEndedFact,
	matchEventFact,
	matchStartedFact,
} from "./match";
import { teamStrategy } from "./plan";

export * from "./ai";
export * from "./match";
export { type MatchPlan, matchPlan, type TeamStrategy } from "./plan";

// Catalog of plan 06: draft rules and fearless series.

const id = z.string().min(1).max(64);
const teamId = id;
const championId = id;

const SIDES = ["blue", "red"] as const;
/**
 * Split side choice (issue #305): the team with priority takes a map side or
 * a draft order (first or last pick) and the rival takes the other kind.
 */
export const SIDE_CHOICES = ["blue", "red", "first", "last"] as const;
const sideChoice = z.enum(SIDE_CHOICES);
export const ROLES = ["top", "jungle", "mid", "bot", "support"] as const;
const FORMATS = ["bo1", "bo3", "bo5"] as const;
const FEARLESS = ["hard", "soft", "off"] as const;
/** Packaged content sets: fictional (default, offline) and real LoL (plan 11). */
export const CONTENT_SETS = ["fictional", "real"] as const;
const contentSet = z.enum(CONTENT_SETS);
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
		format: z.enum(FORMATS),
		fearless: z.enum(FEARLESS),
		timer: z.boolean(),
		pool: z.array(championId).refine(unique, "pool repeats a champion"),
		/** Root seed of the series' RNG (plan 05). */
		seed: uint32,
		/** Which teams the AI plays (plan 07). */
		ai: aiPerTeam.optional(),
		/** Content the series is played with; `fictional` when absent. */
		content: contentSet.optional(),
	}),
	"side.choose": z.strictObject({ team: teamId, choice: sideChoice }),
	"draft.ban": z.strictObject({
		team: teamId,
		champion: championId.nullable(),
	}),
	"draft.pick": z.strictObject({ team: teamId, champion: championId }),
	"draft.timeout": z.strictObject({}),
	/** The AI of the team whose turn it is acts (plan 07). */
	"draft.ai": z.strictObject({}),
	"draft.roles": z.strictObject({ team: teamId, roles: roleAssignment }),
	/** Plays the game after the roles; its winner comes out of play (plan 08). */
	"match.play": z.strictObject({ strategy: teamStrategy.optional() }),
});

export const draftQueries = defineQueries({
	/** `team` is who looks: with soft fearless, availability depends on it. */
	"draft.view": z.strictObject({ team: teamId.optional() }),
	"draft.champion": z.strictObject({
		champion: championId,
		content: contentSet.optional(),
	}),
	/** A strategy suggestion for the only human team in the current draft. */
	"match.plan": z.strictObject({}),
	/** The facts of a played game, to replay it without simulating again. */
	"match.view": z.strictObject({ game: position }),
	/** MVP of the series and the gap of each lane in each game (Q5). */
	"series.summary": z.strictObject({}),
	/**
	 * What the setup screen offers: the teams and the champion pool (plan 09,
	 * U1). Of `content` when given, else of the session's current content.
	 */
	"series.options": z.strictObject({ content: contentSet.optional() }),
});

const factCatalog = defineFacts({
	"series.started": {
		teams: pair(teamId),
		format: z.enum(FORMATS),
		fearless: z.enum(FEARLESS),
		timer: z.boolean(),
		pool: z.array(championId),
		seed: uint32,
		ai: aiPerTeam.optional(),
		content: contentSet.optional(),
	},
	/**
	 * `by`: the team had priority from game 1's draw or from losing the last
	 * game, or took the `rest` its rival left.
	 */
	"side.chosen": {
		game: position,
		team: teamId,
		kind: z.enum(["side", "order"]),
		choice: sideChoice,
		by: z.enum(["draw", "loss", "rest"]),
	},
	"ai.sideDecided": aiSideDecidedFact,
	/** `first` is the team with first pick, whatever its map side. */
	"game.started": { game: position, blue: teamId, red: teamId, first: teamId },
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

export const choiceKind = (choice: SideChoice) =>
	choice === "blue" || choice === "red" ? "side" : "order";

export const draftFacts = {
	schema: factCatalog.schema
		.refine(
			(fact) =>
				fact.type !== "side.chosen" || fact.kind === choiceKind(fact.choice),
			{ path: ["kind"], error: "choice and kind must agree" },
		)
		.refine(
			(fact) =>
				fact.type !== "game.started" ||
				(fact.blue !== fact.red &&
					(fact.first === fact.blue || fact.first === fact.red)),
			{ error: "first pick must belong to one of two distinct map teams" },
		),
};

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
	/** Who acts next; sides are chosen before the teams have one. */
	turn: z
		.union([
			z.strictObject({
				team: teamId,
				side,
				action: z.enum(["ban", "pick", "roles"]),
			}),
			z.strictObject({
				team: teamId,
				action: z.literal("side"),
				/** What the team may take: all four with priority, else the other kind. */
				options: z.array(sideChoice).min(1),
			}),
		])
		.nullable(),
	/** The side choices of the current game, in order: priority first. */
	choices: z.array(z.strictObject({ team: teamId, choice: sideChoice })),
	/** The map side with first pick, once the draft has started. */
	first: side.nullable(),
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

/** What `series.options` answers. Teams follow the content order. */
export const seriesOptions = z.strictObject({
	season: z.number().int().positive().optional(),
	teams: z.array(
		matchContent.shape.teams.element
			.pick({
				id: true,
				name: true,
				seed: true,
				coach: true,
				league: true,
			})
			.extend({
				/** The starter of each role, for the player card (U5). */
				players: z.array(
					z.strictObject({
						id,
						role: z.enum(ROLES),
						handle: aiContent.shape.players.element.shape.handle,
						nationality: aiContent.shape.players.element.shape.nationality,
						attributes: matchContent.shape.players.element.shape.attributes,
						/** Attributes estimated rather than measured; the UI marks them. */
						estimated: aiContent.shape.players.element.shape.estimated,
					}),
				),
			}),
	),
	pool: z.array(championId),
	/** Roles each champion plays, with their tier; for the roles screen's suggestion. */
	positions: z.record(
		championId,
		z.array(z.strictObject({ role: z.enum(ROLES), tier: z.enum(TIERS) })),
	),
	/** Each champion of the pool with the roles it plays, for the role filter (U3). */
	champions: z.array(
		z.strictObject({
			id: championId,
			name: aiContent.shape.champions.element.shape.name,
			roles: z.array(z.enum(ROLES)),
		}),
	),
});

export type SeriesOptions = z.infer<typeof seriesOptions>;
export type ContentSet = (typeof CONTENT_SETS)[number];
export type DraftView = z.infer<typeof draftView>;
export type Role = (typeof ROLES)[number];
export type Side = (typeof SIDES)[number];
export type SideChoice = (typeof SIDE_CHOICES)[number];
