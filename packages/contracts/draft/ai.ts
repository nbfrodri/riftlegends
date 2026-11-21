import { z } from "zod";
import { position } from "../envelope";
import { checkChampionReference, checkDuplicates } from "./content-validation";

// Draft AI of plan 07: settings per team, the decision fact and the content
// it reads. Points are fixed point (scale 10,000, plan 05).

export const PERSONALITIES = [
	"balanced",
	"meta",
	"comfort",
	"counterpick",
	"pocket",
	"architect",
	"early",
	"scaling",
	"flex",
	"star-ban",
	"pool-drain",
	"side-lane",
] as const;

const DIFFICULTIES = ["easy", "normal", "hard"] as const;

export const TIERS = ["S+", "S", "A", "B", "C", "D"] as const;

export const ARCHETYPES = [
	"tank",
	"engage",
	"peel",
	"poke",
	"dive",
	"pick",
	"carry",
	"hypercarry",
	"splitpush",
	"skirmish",
	"utility",
] as const;

const roles = z.enum(["top", "jungle", "mid", "bot", "support"]);
const id = z.string().min(1).max(64);

/** AI of one team. The coach decides the difficulty; without one, `difficulty`. */
const aiSettings = z.strictObject({
	personality: z.enum(PERSONALITIES),
	/** Coach strength in tenths: 0 to 50 (0.0 to 5.0). */
	coachRating: z.int().min(0).max(50).optional(),
	difficulty: z.enum(DIFFICULTIES).optional(),
});

/**
 * In the order of `series.start` teams; `null` is a human team and `"coach"`
 * takes the personality and rating from the team's coach in the content.
 */
const aiOfTeam = z.union([aiSettings, z.literal("coach")]).nullable();
export const aiPerTeam = z.tuple([aiOfTeam, aiOfTeam]);

const points = z.int();

export const aiDecidedFact = {
	game: position,
	/** Index of the step in the draft order. */
	step: position,
	team: id,
	action: z.enum(["ban", "pick"]),
	champion: id.nullable(),
	total: points,
	components: z.array(z.strictObject({ key: id, points })),
	alternatives: z.array(
		z.strictObject({
			champion: id,
			total: points,
			/** Chance of being chosen, per 10,000. */
			chance: z.int().min(0).max(10000),
		}),
	),
	/** The rival's likely answer, when the AI looks ahead. */
	reply: z.strictObject({ champion: id, points }).optional(),
};

/** Everything the draft AI reads (plan 07); plan 10 fills it. */
export const aiContent = z
	.strictObject({
		champions: z.array(
			z.strictObject({
				id,
				/** Proper name shared by all locales for fictional content. */
				name: z.string().min(1).max(64),
				positions: z
					.array(z.strictObject({ role: roles, tier: z.enum(TIERS) }))
					.min(1),
				damage: z.enum(["physical", "magic", "mixed", "utility"]),
				archetypes: z.array(z.enum(ARCHETYPES)),
				power: z.enum(["early", "mid", "late"]),
			}),
		),
		/** How well `champion` does against `against` in `role`, −10 to 10. */
		matchups: z.array(
			z.strictObject({
				champion: id,
				against: id,
				role: roles,
				value: z.int().min(-10).max(10),
			}),
		),
		synergies: z.array(
			z.strictObject({ a: id, b: id, value: z.int().min(0).max(6) }),
		),
		/** Team plans; `threshold` is how many matching archetypes enable one. */
		identities: z.array(
			z.strictObject({
				id,
				archetypes: z.array(z.enum(ARCHETYPES)),
				threshold: z.int().min(1).max(5),
			}),
		),
		players: z.array(
			z.strictObject({
				id,
				team: id,
				role: roles,
				level: z.int().min(0).max(100),
				mains: z.array(id),
				secondary: z.array(id),
				weak: z.array(id),
			}),
		),
	})
	.superRefine((content, ctx) => {
		checkDuplicates(ctx, "champions", content.champions, (row) => row.id, "id");
		checkDuplicates(ctx, "players", content.players, (row) => row.id, "id");
		checkDuplicates(
			ctx,
			"matchups",
			content.matchups,
			({ champion, against, role }) =>
				JSON.stringify([champion, against, role]),
		);
		checkDuplicates(ctx, "synergies", content.synergies, ({ a, b }) =>
			JSON.stringify([a, b].sort()),
		);

		const champions = new Set(content.champions.map((row) => row.id));
		content.players.forEach((player, index) => {
			for (const pool of ["mains", "secondary", "weak"] as const) {
				player[pool].forEach((champion, slot) => {
					checkChampionReference(ctx, champions, champion, [
						"players",
						index,
						pool,
						slot,
					]);
				});
			}
		});
		content.matchups.forEach(({ champion, against }, index) => {
			checkChampionReference(ctx, champions, champion, [
				"matchups",
				index,
				"champion",
			]);
			checkChampionReference(ctx, champions, against, [
				"matchups",
				index,
				"against",
			]);
		});
		content.synergies.forEach(({ a, b }, index) => {
			checkChampionReference(ctx, champions, a, ["synergies", index, "a"]);
			checkChampionReference(ctx, champions, b, ["synergies", index, "b"]);
		});
	});

export type AiContent = z.infer<typeof aiContent>;
export type AiSettings = z.infer<typeof aiSettings>;
export type AiOfTeam = z.infer<typeof aiOfTeam>;
export type Personality = (typeof PERSONALITIES)[number];
