import { z } from "zod";

// The pipeline runs this file with plain Node, which cannot load `./index.ts`
// (extensionless imports); the roles are the ones of `ROLES` there.
const ROLES = ["top", "jungle", "mid", "bot", "support"] as const;

/** The summoner spells of Summoner's Rift (CommunityDragon `CLASSIC` mode). */
export const SUMMONER_SPELLS = [
	"Barrier",
	"Cleanse",
	"Exhaust",
	"Flash",
	"Ghost",
	"Heal",
	"Ignite",
	"Smite",
	"Teleport",
] as const;
const spellId = z.enum(SUMMONER_SPELLS);
const count = z.number().int().min(0);

/** Pairs below this many games of a champion and role are not published. */
export const MIN_PAIR_GAMES = 20;

/** Two different spells in alphabetical order; Smite only in the jungle. */
const pair = z
	.tuple([spellId, spellId])
	.refine(([a, b]) => a < b, "A pair is two different spells in order");

const jungleRule = (value: { role: string; spells: readonly string[] }) =>
	value.spells.includes("Smite") === (value.role === "jungle");

/**
 * Summoner spell data of the real content (#622): cooldowns from
 * CommunityDragon (data only, no images) and the usual pair per champion and
 * role from Leaguepedia, aggregated: no game, team or player is stored.
 */
export const realSummonersSchema = z
	.strictObject({
		provenance: z.strictObject({
			cooldowns: z.strictObject({
				source: z.literal("CommunityDragon"),
				patch: z.string().min(1),
				url: z.url(),
				retrievedAt: z.string().min(1),
			}),
			pairs: z.strictObject({
				source: z.literal("Leaguepedia"),
				domain: z.literal("lol.fandom.com"),
				licence: z.string().min(1),
				attribution: z.string().min(1),
				season: z.number().int(),
				minGames: z.literal(MIN_PAIR_GAMES),
				/** Scoreboard rows with a valid spell pair. */
				rows: count,
			}),
		}),
		spells: z.array(
			z.strictObject({
				id: spellId,
				/** Seconds. */
				cooldown: z.number().int().positive(),
			}),
		),
		/** Fallback when a champion has no pair of its own: the usual one of the role. */
		roleDefaults: z.strictObject(
			Object.fromEntries(
				ROLES.map((role) => [
					role,
					z
						.strictObject({ spells: pair, games: count })
						.refine(
							({ spells }) => jungleRule({ role, spells }),
							"Smite only in the jungle",
						),
				]),
			) as Record<
				(typeof ROLES)[number],
				z.ZodObject<{ spells: typeof pair; games: z.ZodNumber }>
			>,
		),
		pairs: z.array(
			z
				.strictObject({
					champion: z.string().min(1),
					role: z.enum(ROLES),
					spells: pair,
					/** Games of the champion in the role with a known pair. */
					games: count.min(MIN_PAIR_GAMES),
					/** Games that used this pair. */
					pairGames: count,
				})
				.refine(jungleRule, "Smite only in the jungle")
				.refine(
					({ games, pairGames }) => pairGames >= 1 && pairGames <= games,
					"pairGames is a part of games",
				),
		),
	})
	.superRefine((file, ctx) => {
		const known = new Set(file.spells.map(({ id }) => id));
		if (known.size !== file.spells.length)
			ctx.addIssue({ code: "custom", message: "Duplicated spell" });
		const used = [
			...file.pairs.map(({ spells }) => spells),
			...Object.values(file.roleDefaults).map(({ spells }) => spells),
		].flat();
		for (const id of used)
			if (!known.has(id))
				ctx.addIssue({ code: "custom", message: `No cooldown for ${id}` });
		const keys = file.pairs.map(({ champion, role }) => `${champion}/${role}`);
		if (new Set(keys).size !== keys.length)
			ctx.addIssue({ code: "custom", message: "Duplicated champion and role" });
	});

export type RealSummoners = z.infer<typeof realSummonersSchema>;
