import { z } from "zod";
import { position } from "../envelope";
import { PERSONALITIES } from "./ai";

// Match simulation of plan 08: its facts and the content it reads. Points
// and chances are fixed point (scale 10,000, plan 05).

export const MATCH_EVENTS = [
	"lane",
	"gank",
	"kill",
	"fight",
	"siege",
	"tower",
	"inhibitor",
	"dragon",
	"herald",
	"baron",
	"elder",
	"nexus",
] as const;

/** Where an event happens, for the minimap (plan 23). */
export const MAP_ZONES = [
	"lane-top",
	"lane-mid",
	"lane-bot",
	"jungle-blue-top",
	"jungle-blue-bot",
	"jungle-red-top",
	"jungle-red-bot",
	"dragon-pit",
	"baron-pit",
	"base-blue",
	"base-red",
] as const;

/** Twenty ratings from 0 to 100, by area (plan 08, "Atributos de jugador"). */
export const PLAYER_ATTRIBUTES = [
	// Lane
	"lanes",
	"farming",
	"waves",
	// Map
	"macro",
	"roaming",
	"vision",
	"anticipation",
	"objectiveControl",
	// Fight
	"teamfight",
	"mechanics",
	"positioning",
	"aggression",
	// Mental
	"composure",
	"resilience",
	"experience",
	"consistency",
	"focus",
	// Team
	"shotcalling",
	"communication",
	"versatility",
] as const;

export type PlayerAttribute = (typeof PLAYER_ATTRIBUTES)[number];

const id = z.string().min(1).max(64);
const side = z.enum(["blue", "red"]);
const points = z.int();
/** Per 10,000. */
const share = z.int().min(0).max(10000);
const perSide = <T extends z.ZodType>(item: T) =>
	z.strictObject({ blue: item, red: item });

const teamProfile = z.strictObject({
	phases: z.strictObject({ early: points, mid: points, late: points }),
	contests: z.strictObject({
		lane: points,
		jungle: points,
		fight: points,
		objective: points,
		siege: points,
	}),
});

export const matchStartedFact = {
	game: position,
	blue: id,
	red: id,
	profiles: perSide(teamProfile),
};

export const matchEventFact = {
	game: position,
	minute: position,
	second: z.int().min(0).max(59),
	kind: z.enum(MATCH_EVENTS),
	/** The side that won the event. */
	side,
	zone: z.enum(MAP_ZONES),
	kills: z.array(
		z.strictObject({ killer: id, victim: id, assists: z.array(id) }),
	),
	/** Gold each side earned from the event. */
	gold: perSide(z.int().nonnegative()),
	/** Chance `side` had of winning the event. */
	chance: share,
	causes: z.array(z.strictObject({ key: id, points })),
	/** Towers: 1 to 3 along the lane, 4 the nexus towers. */
	tier: z.int().min(1).max(4).optional(),
};

export const matchEndedFact = {
	game: position,
	winner: id,
	/** In seconds. */
	duration: position,
	players: z.array(
		z.strictObject({
			player: id,
			team: id,
			champion: id,
			kills: position,
			deaths: position,
			assists: position,
			gold: position,
			damage: position,
			participation: share,
			rating: z.int().min(0).max(100),
		}),
	),
	/** Events that swung the chance the most, by their index among this game's `match.event` facts. */
	decisive: z.array(z.strictObject({ event: position, swing: points })).max(3),
};

const rating = z.int().min(0).max(100);
const stat = z.int().min(0).max(10);
const seconds = position;
const timer = z.strictObject({ first: seconds, respawn: seconds });

/** Everything the simulation reads besides the draft content (plan 07). */
export const matchContent = z.strictObject({
	players: z.array(
		z.strictObject({
			id,
			attributes: z.strictObject(
				Object.fromEntries(
					PLAYER_ATTRIBUTES.map((key) => [key, rating]),
				) as Record<PlayerAttribute, typeof rating>,
			),
			/** Calls the plays in game. */
			leader: z.boolean(),
			mastery: z.array(z.strictObject({ champion: id, value: rating })),
		}),
	),
	teams: z.array(
		z.strictObject({
			id,
			/** Proper name shown in the UI; it is not translated. */
			name: z.string().min(1).max(64).optional(),
			/** Decides the team's draft AI; without one, a default (plan 09, Q2). */
			coach: z
				.strictObject({
					name: z.string().min(1).max(64),
					personality: z.enum(PERSONALITIES),
					/** In tenths: 0 to 50 (0.0 to 5.0), as `coachRating` of the AI. */
					rating: z.int().min(0).max(50),
				})
				.optional(),
			/** Between two players of the team. */
			chemistry: z.array(z.strictObject({ a: id, b: id, value: rating })),
			strategy: z.strictObject({
				tempo: z.enum(["slow", "balanced", "fast"]),
				objectives: z.enum(["dragon", "balanced", "baron"]),
				risk: z.enum(["safe", "balanced", "risky"]),
			}),
			/** How well the coach adapts between games. */
			adaptation: rating,
		}),
	),
	champions: z.array(
		z.strictObject({ id, cc: stat, mobility: stat, frontline: stat }),
	),
	rules: z.strictObject({
		objectives: z.strictObject({
			dragon: timer,
			herald: timer,
			baron: timer,
			elder: timer,
		}),
		inhibitorRespawn: seconds,
		economy: z.strictObject({
			/** Per team and minute. */
			passive: position,
			kill: position,
			assist: position,
			tower: position,
			inhibitor: position,
			dragon: position,
			herald: position,
			baron: position,
			elder: position,
		}),
		/** How much gold counts from each minute on; it falls as games go on. */
		goldWeight: z
			.array(z.strictObject({ minute: position, weight: share }))
			.min(1),
		/** Edge of the blue side, in fixed-point points (30,000 = 3 points). */
		blueSide: points,
	}),
});

export type MatchContent = z.infer<typeof matchContent>;
export type MatchEvent = z.infer<z.ZodObject<typeof matchEventFact>>;

/** What `match.view` answers: the facts a game emitted, without positions. */
export const matchView = z.strictObject({
	game: position,
	facts: z.array(
		z.discriminatedUnion("type", [
			z.strictObject({ type: z.literal("match.started"), ...matchStartedFact }),
			z.strictObject({ type: z.literal("match.event"), ...matchEventFact }),
			z.strictObject({ type: z.literal("match.ended"), ...matchEndedFact }),
		]),
	),
});

export type MatchView = z.infer<typeof matchView>;
