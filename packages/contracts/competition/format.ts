import { z } from "zod";

// Competition formats as data (plan 12). Cross-stage rules (not-enough-teams,
// invalid-stage-ref, slots-mismatch) need the whole season and live in the core.

const id = z.string().min(1).max(64);
const teamId = id;
const stageId = id;
const competitionId = id;

/** Best-of lengths a series can have: 1, 3 or 5. */
const bestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);

/** Season-wide cap on series per match day (decision 4 of plan 12). */
export const MAX_SERIES_PER_DAY = 4;

/** Whole days from the season start are counted by the core; weeks only here. */
const window = z.strictObject({
	startWeek: z.int().min(0).max(60),
	weeks: z.int().min(1).max(60),
	matchDays: z.int().min(1).max(7),
	maxSeriesPerDay: z
		.int()
		.min(1)
		.max(MAX_SERIES_PER_DAY)
		.default(MAX_SERIES_PER_DAY),
});

const teamCount = z.int().min(2).max(32);

const roundRobin = z.strictObject({
	type: z.literal("roundRobin"),
	size: teamCount,
	rounds: z.union([z.literal(1), z.literal(2)]),
	bestOf,
});

const groups = z.strictObject({
	type: z.literal("groups"),
	size: teamCount,
	count: z.int().min(1).max(16),
	/** `cross`: each team plays only the other groups (LCK Cup). */
	seeding: z.enum(["snake", "cross", "ranked"]),
	inner: z.strictObject({
		rounds: z.union([z.literal(1), z.literal(2)]),
		bestOf,
	}),
});

const swiss = z.strictObject({
	type: z.literal("swiss"),
	size: teamCount,
	wins: z.int().min(1).max(5),
	losses: z.int().min(1).max(5),
	bestOf,
	/** Bo of the series that qualify or eliminate. */
	decisiveBestOf: bestOf,
	round1: z.literal("pots"),
	/** Constraints in the order they are relaxed (region first). */
	avoid: z.array(z.enum(["region", "rematch"])).max(2),
});

const singleElim = z.strictObject({
	type: z.literal("singleElim"),
	size: teamCount,
	/** One Bo per round, first round first. */
	bestOf: z.array(bestOf).min(1).max(5),
});

const doubleElim = z.strictObject({
	type: z.literal("doubleElim"),
	/** Every team, including the ones that enter the lower bracket directly. */
	size: teamCount,
	upper: z.array(bestOf).min(1).max(5),
	lower: z.array(bestOf).min(1).max(8),
	/**
	 * Lower round (0-based) each series' loser drops to, per upper round and
	 * per series; `null` means the loser is out.
	 */
	drop: z
		.array(z.array(z.int().min(0).max(7).nullable()).min(1).max(16))
		.min(1)
		.max(5),
	/** Seeds that enter the lower bracket directly in each lower round (worst seeds first). */
	lowerSeeds: z.array(z.int().min(0).max(8)).max(8).default([]),
	/** `null`: no grand final (GSL groups); the upper and lower finals decide the ranking. */
	grandFinal: bestOf.nullable(),
	/** Extra final when the lower bracket wins (off in LoL). */
	reset: z.boolean(),
});

const play = z.discriminatedUnion("type", [
	roundRobin,
	groups,
	swiss,
	singleElim,
	doubleElim,
]);

const source = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("fixed"),
		teams: z.array(teamId).min(1).max(32),
	}),
	/** Teams ranked `from` to `to` (1-based) in an earlier stage. */
	z.strictObject({
		kind: z.literal("standing"),
		stage: stageId,
		competition: competitionId.optional(),
		from: z.int().min(1),
		to: z.int().min(1),
	}),
	z.strictObject({
		kind: z.literal("bracket"),
		stage: stageId,
		competition: competitionId.optional(),
		match: id,
		result: z.enum(["winner", "loser"]),
	}),
	/** The teams that other competitions qualified into this one. */
	z.strictObject({
		kind: z.literal("qualified"),
		competition: competitionId,
		/** Optional 1-based places from specific leagues, in seed order. */
		places: z
			.array(
				z.strictObject({
					league: competitionId,
					place: z.int().min(1).max(32),
				}),
			)
			.min(1)
			.max(32)
			.optional(),
	}),
	/** Qualified teams of these competitions, drawn from `pots` pots by region and place. */
	z.strictObject({
		kind: z.literal("pots"),
		from: z.array(competitionId).min(1).max(8),
		pots: z.int().min(1).max(8),
	}),
]);

const stage = z.strictObject({
	id: stageId,
	window,
	/** Multiple sources fill the seed list in declaration order. */
	entrants: z.union([source, z.array(source).min(1).max(32)]),
	play,
	draw: z
		.strictObject({
			pots: z.int().min(1).max(8),
			avoidSameLeague: z.boolean().optional(),
		})
		.optional(),
});

const CRITERIA = [
	"seriesWins",
	"gameDiff",
	"headToHead",
	"gameWins",
	"tiebreakerSeries",
	"draw",
] as const;
const criterion = z.enum(CRITERIA);

const slot = z.strictObject({
	to: competitionId,
	rule: z.enum(["stageWinner", "standing", "points"]),
	/** Stage the rule reads; `points` reads the whole season. */
	stage: stageId.optional(),
	count: z.int().min(1).max(8),
	/** When the team already has a place: `next` passes it down the ranking. */
	cascade: z.enum(["next", "vacant"]),
});

const rounds = (size: number) => Math.ceil(Math.log2(size));

/** Series played in each upper round of `size` teams (byes play none). */
const upperSeries = (size: number): number[] => {
	const count = rounds(size);
	const full = 2 ** count;
	return Array.from({ length: count }, (_, r) =>
		r === 0 ? size - full / 2 : full / 2 ** (r + 1),
	);
};

const issue = (
	ctx: z.RefinementCtx,
	path: (string | number)[],
	message: string,
) => ctx.addIssue({ code: "custom", path, message });

export const competitionSchema = z
	.strictObject({
		id: competitionId,
		kind: z.enum(["league", "international"]),
		stages: z.array(stage).min(1).max(12),
		tiebreak: z.array(criterion).max(CRITERIA.length),
		/** Bo of the tiebreaker series that decides a tie at a cut. */
		tiebreakerBestOf: bestOf.default(3),
		slots: z.array(slot).max(16).optional(),
		/** False while the format is not checked against the rulebook. */
		verified: z.boolean(),
	})
	.superRefine((c, ctx) => {
		const seen = new Set<string>();
		c.stages.forEach((s, i) => {
			if (seen.has(s.id)) issue(ctx, ["stages", i, "id"], "repeated stage id");
			seen.add(s.id);
			const p = ["stages", i, "play"];
			const play = s.play;
			if (play.type === "groups" && play.size < 2 * play.count) {
				issue(ctx, [...p, "size"], "every group needs two teams");
			}
			if (
				play.type === "swiss" &&
				play.wins + play.losses - 1 > play.size - 1
			) {
				issue(ctx, [...p, "size"], "more rounds than opponents");
			}
			if (
				play.type === "singleElim" &&
				play.bestOf.length !== rounds(play.size)
			) {
				issue(ctx, [...p, "bestOf"], "one Bo per round");
			}
			if (play.type === "doubleElim") {
				if (play.grandFinal === null && play.reset) {
					issue(ctx, [...p, "reset"], "a reset needs a grand final");
				}
				const seeds = play.lowerSeeds;
				const entering = seeds.reduce((a, b) => a + b, 0);
				const upperSize = play.size - entering;
				if (seeds.length > play.lower.length || upperSize < 2) {
					issue(ctx, [...p, "lowerSeeds"], "lower entrants do not fit");
				} else {
					const series = upperSeries(upperSize);
					if (play.upper.length !== series.length)
						issue(ctx, [...p, "upper"], "one Bo per upper round");
					const fits =
						play.drop.length === series.length &&
						play.drop.every((d, r) => d.length === series[r]) &&
						play.drop.every((d) =>
							d.every((k) => k === null || k < play.lower.length),
						);
					if (!fits) issue(ctx, [...p, "drop"], "one drop per upper series");
				}
			}
			const sources = Array.isArray(s.entrants) ? s.entrants : [s.entrants];
			sources.forEach((entry, index) => {
				if (entry.kind !== "standing" || entry.to >= entry.from) return;
				const path: (string | number)[] = ["stages", i, "entrants"];
				if (Array.isArray(s.entrants)) path.push(index);
				issue(ctx, [...path, "to"], "empty range");
			});
		});
		if (new Set(c.tiebreak).size !== c.tiebreak.length) {
			issue(ctx, ["tiebreak"], "repeated criterion");
		}
		const draw = c.tiebreak.indexOf("draw");
		if (draw !== -1 && draw !== c.tiebreak.length - 1) {
			issue(ctx, ["tiebreak", draw], "draw must be the last criterion");
		}
		c.slots?.forEach((sl, i) => {
			if (sl.rule !== "points" && sl.stage === undefined) {
				issue(ctx, ["slots", i, "stage"], "this rule reads a stage");
			}
		});
	});

export type Competition = z.infer<typeof competitionSchema>;
