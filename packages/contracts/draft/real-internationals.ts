import { z } from "zod";

/**
 * First Stand, MSI and Worlds of the snapshot season (`internationals.json`),
 * made by the data pipeline from Leaguepedia (CC BY-SA 3.0). Only finished
 * series: the curated formats are checked against them (plan 12, R1).
 */
const text = z.string().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const match = z
	.strictObject({
		tournament: text,
		tab: text,
		id: text,
		date,
		team1: text,
		team2: text,
		score1: z.int().min(0).max(3),
		score2: z.int().min(0).max(3),
		bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
	})
	.refine((m) => m.team1 !== m.team2, { error: "a team cannot face itself" })
	.refine(
		(m) => {
			const wins = (m.bestOf + 1) / 2;
			return Math.max(m.score1, m.score2) === wins && m.score1 !== m.score2;
		},
		{ error: "the winner must reach exactly the wins the Bo needs" },
	);

const event = z
	.strictObject({
		id: z.enum(["first-stand", "msi", "worlds"]),
		name: text,
		tournaments: z
			.array(
				z.strictObject({
					id: text,
					name: text,
					startsOn: date,
					endsOn: date,
				}),
			)
			.min(1),
		matches: z.array(match).min(1),
	})
	.refine(
		(e) =>
			e.matches.every((m) => e.tournaments.some((t) => t.id === m.tournament)),
		{ error: "every series belongs to a listed tournament" },
	);

export const realInternationalsSchema = z.strictObject({
	provenance: z.strictObject({
		source: z.literal("Leaguepedia"),
		domain: z.literal("lol.fandom.com"),
		retrievedAt: z.iso.datetime(),
		licence: z.literal("CC BY-SA 3.0"),
		attribution: text,
		queries: z.array(
			z.strictObject({ url: z.url(), retrievedAt: z.iso.datetime() }),
		),
	}),
	season: z.int().min(2000).max(2100),
	events: z.array(event).min(1),
});

export type RealInternationals = z.infer<typeof realInternationalsSchema>;
export type InternationalMatch =
	RealInternationals["events"][number]["matches"][number];
