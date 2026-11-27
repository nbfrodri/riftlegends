import { z } from "zod";
import { position } from "../envelope";
import { PERSONALITIES } from "./ai";
import { checkChampionReference, checkDuplicates } from "./content-validation";
import { teamStrategy } from "./plan";
import { PLAYER_ATTRIBUTES, type PlayerAttribute } from "./player-attributes";
import { snapshotLogo } from "./snapshot-content";

export {
	LOW_RELEVANCE,
	PLAYER_ATTRIBUTES,
	type PlayerAttribute,
} from "./player-attributes";

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
	"grub",
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

const id = z.string().min(1).max(64);
const side = z.enum(["blue", "red"]);
const points = z.int();
/** Per 10,000. */
const share = z.int().min(0).max(10000);
const multikillCount = z.union([
	z.literal(2),
	z.literal(3),
	z.literal(4),
	z.literal(5),
]);
const MATCH_ROLES = ["top", "jungle", "mid", "bot", "support"] as const;

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
		z.strictObject({
			killer: id,
			victim: id,
			assists: z.array(id),
			/** Seconds since the opening kill of this fight. */
			fightSecond: position.optional(),
			/** Highest tier of the chain, on the kill that completed it. */
			multikill: multikillCount.optional(),
			firstBlood: z
				.strictObject({
					killerGold: position,
					assistGold: position,
				})
				.optional(),
			/** Consecutive kills without dying, recorded at each tier reached. */
			spree: z
				.union([
					z.literal(3),
					z.literal(4),
					z.literal(5),
					z.literal(6),
					z.literal(7),
					z.literal(8),
				])
				.optional(),
			/** Additional gold paid to the killer for ending the victim's spree. */
			shutdown: z.int().positive().optional(),
			soloKill: z.literal(true).optional(),
			/** Second of the game the victim comes back; absent in older logs. */
			respawnAt: position.optional(),
			/** The casualty that left all five opponents down in this fight. */
			ace: z.literal(true).optional(),
		}),
	),
	/**
	 * Roles of each side that were down when the contest started, listed only
	 * when someone was (issue #529); absent in older logs.
	 */
	down: z
		.strictObject({
			blue: z.array(z.enum(MATCH_ROLES)).max(5),
			red: z.array(z.enum(MATCH_ROLES)).max(5),
		})
		.refine(
			({ blue, red }) => blue.length + red.length > 0,
			"list who was down only when someone was",
		)
		.optional(),
	/** Gold each side earned from the event. */
	gold: perSide(z.int().nonnegative()),
	/** Chance `side` had of winning the event. */
	chance: share,
	causes: z.array(z.strictObject({ key: id, points })),
	/** Towers: 1 to 3 along the lane, 4 the nexus towers. */
	tier: z.int().min(1).max(4).optional(),
	/** Void grubs: how many each side took of the group of three. */
	grubs: perSide(z.int().nonnegative()).optional(),
	/** The opposing jungler took the objective from the side controlling the pit. */
	steal: z
		.strictObject({
			jungler: id,
			controllingSide: side,
			defenders: z.int().min(2).max(5),
			opposingSmite: z.boolean(),
		})
		.optional(),
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
			/** Simulated vision score of the game. */
			vision: position,
			rating: z.int().min(0).max(100),
		}),
	),
	/** Events that swung the chance the most, by their index among this game's `match.event` facts. */
	decisive: z.array(z.strictObject({ event: position, swing: points })).max(3),
	/** Each completed streak and its fight's index among this game's events. */
	multikills: z
		.array(
			z.strictObject({ event: position, killer: id, count: multikillCount }),
		)
		.optional(),
};

const rating = z.int().min(0).max(100);
const stat = z.int().min(0).max(10);
const seconds = position;
const timer = z.strictObject({ first: seconds, respawn: seconds });
const roleLevels = z.array(z.int().min(10).max(200)).min(1);

/**
 * Death time of the wiki (issue #528): `BRW + BRW × TIF`. `brw` is the base
 * in tenths of a second for levels 1 to 18; each `tif` step starts at `from`
 * seconds, adds `perStep` thousandths of a point every `step` seconds on top
 * of `base`, and the sum never passes `cap` (of 100,000).
 */
const deathTimer = z.strictObject({
	brw: z.array(z.int().min(1)).length(18),
	step: z.int().min(1),
	tif: z
		.array(
			z.strictObject({
				from: seconds,
				base: position,
				perStep: position,
			}),
		)
		.min(1),
	cap: z.int().min(0).max(100_000),
});

/** How much each role counts in a contest, per 10,000 (issue #529). */
const presenceWeight = z.int().min(0).max(10_000);
const presenceTable = z
	.strictObject({
		top: presenceWeight,
		jungle: presenceWeight,
		mid: presenceWeight,
		bot: presenceWeight,
		support: presenceWeight,
	})
	.refine(
		(table) =>
			Object.values(table).reduce((sum, value) => sum + value, 0) === 10_000,
		"the weights of a contest add up to 10,000",
	);

/**
 * What a won fight lets its winner take before the rival is level (plan 08,
 * #530). Times are in seconds; chances are per 10,000.
 */
const conversion = z.strictObject({
	/** Seconds after the last kill of the fight before the winner starts. */
	delay: seconds,
	/** What each thing taken costs the winner in seconds. */
	cost: z.strictObject({
		tower: seconds,
		inhibitor: seconds,
		nexus: seconds,
		dragon: seconds,
		herald: seconds,
		baron: seconds,
		elder: seconds,
	}),
	/** Chance that a winner up 1 to 5 players more goes for what he can take. */
	commit: z.array(z.int().min(0).max(10_000)).length(5),
	/** The nexus falls to a window only against this many up or fewer. */
	closeWithUp: z.int().min(0).max(4),
	/** No window takes the nexus before this minute. */
	nexusFrom: z.int().min(1),
});

/** Everything the simulation reads besides the draft content (plan 07). */
export const matchContent = z
	.strictObject({
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
				name: z.string().min(1).max(64),
				short: id.optional(),
				league: id.optional(),
				logo: snapshotLogo.optional(),
				/** Seeding order, with 1 as the best seed. */
				seed: z.int().positive(),
				/** Decides the team's draft AI. */
				coach: z.strictObject({
					name: z.string().min(1).max(64),
					personality: z.enum(PERSONALITIES),
					/** In tenths: 0 to 50 (0.0 to 5.0), as `coachRating` of the AI. */
					rating: z.int().min(0).max(50),
				}),
				/** Between two players of the team. */
				chemistry: z.array(z.strictObject({ a: id, b: id, value: rating })),
				strategy: teamStrategy,
				/** How well the coach adapts between games. */
				adaptation: rating,
			}),
		),
		champions: z.array(
			z.strictObject({ id, cc: stat, mobility: stat, frontline: stat }),
		),
		rules: z.strictObject({
			objectives: z.strictObject({
				/** One group of three, up from `first` until `despawn`; no respawn. */
				grub: z.strictObject({ first: seconds, despawn: seconds }),
				dragon: timer,
				herald: timer,
				baron: timer,
				elder: timer,
			}),
			inhibitorRespawn: seconds,
			deathTimer,
			conversion,
			/**
			 * Weight of each role among the players up in each contest, so that
			 * a missing player costs what he is worth there (issue #529). In a
			 * lane only its laners count.
			 */
			presence: z.strictObject({
				lane: z.strictObject({
					top: presenceTable,
					mid: presenceTable,
					bot: presenceTable,
				}),
				jungle: presenceTable,
				fight: presenceTable,
				objective: presenceTable,
				siege: presenceTable,
			}),
			/** Median level per role and minute, in tenths, until #338 levels players. */
			levelCurve: z
				.strictObject({
					top: roleLevels,
					jungle: roleLevels,
					mid: roleLevels,
					bot: roleLevels,
					support: roleLevels,
				})
				.refine(
					(curve) =>
						new Set(Object.values(curve).map((list) => list.length)).size === 1,
					"every role needs the same number of minutes",
				),
			economy: z.strictObject({
				/** Per team and minute. */
				passive: position,
				kill: position,
				assist: position,
				tower: position,
				inhibitor: position,
				/** Per grub, for the whole team. */
				grub: position,
				dragon: position,
				herald: position,
				baron: position,
				elder: position,
			}),
			/** Gold of a full build per player: above it gold helps little (G3). */
			fullBuildGold: z.int().min(1),
			/** Share of the gold above the full build that still counts, per 10,000. */
			goldOverflow: share,
			/** Points of a full relative gold lead, in fixed-point points (G2). */
			goldLeadPoints: points,
			/** Cap of the gold cause, in fixed-point points. */
			goldMaxPoints: z.int().min(0),
			/** Edge of the blue side, in fixed-point points (30,000 = 3 points). */
			blueSide: points,
		}),
	})
	.superRefine((content, ctx) => {
		checkDuplicates(ctx, "champions", content.champions, (row) => row.id, "id");
		checkDuplicates(ctx, "players", content.players, (row) => row.id, "id");
		checkDuplicates(ctx, "teams", content.teams, (row) => row.id, "id");
		checkDuplicates(ctx, "teams", content.teams, (row) => row.seed, "seed");

		const champions = new Set(content.champions.map((row) => row.id));
		content.players.forEach(({ mastery }, index) => {
			mastery.forEach(({ champion }, slot) => {
				checkChampionReference(ctx, champions, champion, [
					"players",
					index,
					"mastery",
					slot,
					"champion",
				]);
			});
		});
	});

export type MatchContent = z.infer<typeof matchContent>;
export type MatchEvent = z.infer<z.ZodObject<typeof matchEventFact>>;

const lanes = z.strictObject({
	top: position,
	mid: position,
	bot: position,
});
const lanesBack = z.strictObject({
	top: position.nullable(),
	mid: position.nullable(),
	bot: position.nullable(),
});

/** One side of the map at the end of a minute (plan 09, Q4). */
const mapSide = z.strictObject({
	gold: position,
	kills: position,
	/** Towers this side has lost in each lane (0 to 3). */
	towers: lanes,
	/** Nexus towers this side has lost (0 to 2). */
	nexusTowers: position,
	/** Minute each lost inhibitor is back; null while it stands. */
	inhibitors: lanesBack,
	/** Dragons this side has taken. */
	dragons: position,
	/** The side has the soul: four dragons. */
	soul: z.boolean(),
	/** Void grubs taken: each is a permanent stack against structures. */
	grubs: position,
	heralds: position,
	barons: position,
	elders: position,
	/** Minute each active buff wears off; null if it is not active. */
	buffs: z.strictObject({
		herald: position.nullable(),
		baron: position.nullable(),
		elder: position.nullable(),
	}),
});

/** The map after `minute`; minute 0 is the start. */
export const mapSnapshot = z.strictObject({
	minute: position,
	blue: mapSide,
	red: mapSide,
	/** Blue then red, each in role order. CS is a cosmetic estimate. */
	players: z.array(
		z.strictObject({
			player: id,
			kills: position,
			deaths: position,
			assists: position,
			gold: position,
			cs: position,
			/** Second of the game the player comes back; alive when it is not ahead. */
			respawnAt: position.optional(),
		}),
	),
});

export type MapSnapshot = z.infer<typeof mapSnapshot>;

/**
 * What `match.view` answers: the facts a game emitted, without positions, and
 * the state of the map at each minute.
 */
export const matchView = z.strictObject({
	game: position,
	facts: z.array(
		z.discriminatedUnion("type", [
			z.strictObject({ type: z.literal("match.started"), ...matchStartedFact }),
			z.strictObject({ type: z.literal("match.event"), ...matchEventFact }),
			z.strictObject({ type: z.literal("match.ended"), ...matchEndedFact }),
		]),
	),
	snapshots: z.array(mapSnapshot),
});

export type MatchView = z.infer<typeof matchView>;

/** Rating points of difference in a lane from which it counts as a gap (plan 09, Q5). */
export const GAP_RATING = 15;

const lineGap = z.strictObject({
	role: z.enum(MATCH_ROLES),
	/** Blue rating minus red rating. */
	rating: z.int(),
	/** Blue gold minus red gold. */
	gold: z.int(),
	/** Side with the better rating; null if tied. */
	favored: side.nullable(),
	/** The rating difference passes the threshold. */
	gap: z.boolean(),
});

/** What `series.summary` answers (plan 09, Q5). */
export const seriesSummary = z.strictObject({
	mvp: z
		.strictObject({
			player: id,
			team: id,
			champions: z.array(id),
			/** Mean rating over the games played, in tenths. */
			rating: position,
			kills: position,
			deaths: position,
			assists: position,
			/** Mean participation per 10,000. */
			participation: share,
			games: position,
		})
		.nullable(),
	lanes: z.array(z.strictObject({ game: position, lines: z.array(lineGap) })),
});

export type SeriesSummary = z.infer<typeof seriesSummary>;
