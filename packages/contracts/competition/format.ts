import { z } from "zod";

// Competition formats as data (plan 12). Cross-stage rules (not-enough-teams,
// invalid-stage-ref, slots-mismatch) need the whole season and live in the core.

const id = z.string().min(1).max(64);
const teamId = id;
const stageId = id;
const competitionId = id;

/** Best-of lengths a series can have: 1, 3 or 5. */
const bestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);

/** Cap on series per match day in each competition (decision 4 of plan 12). */
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
	/** A final cross-group round, with a week offset from the stage start. */
	finalRound: z
		.strictObject({
			bestOf,
			groupPoints: z.int().min(1).max(32),
			week: z.int().min(0).max(59),
		})
		.optional(),
});

const swiss = z.strictObject({
	type: z.literal("swiss"),
	size: teamCount,
	wins: z.int().min(1).max(5),
	losses: z.int().min(1).max(5),
	maxRounds: z.int().min(1).max(9).optional(),
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
		group: z.enum(["winner", "loser"]).optional(),
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

const potsDraw = z.strictObject({
	pots: z.int().min(1).max(8),
	avoidSameLeague: z.boolean().optional(),
});

/** Bracket draw constraints, in the order they are relaxed (plan 12 §6). */
export const DRAW_RULES = ["regionHalf", "region", "rematch"] as const;
export const drawRule = z.enum(DRAW_RULES);

const tierIndex = z.int().min(1).max(32);

/**
 * A first-round draw of an elimination bracket. Tiers hold 1-based places of
 * the entry list, best first; each pair of `meet` crosses two tiers (the first
 * one never after the second); the remaining teams are paired at random.
 */
const bracketDraw = z.strictObject({
	tiers: z.array(z.array(tierIndex).min(1).max(32)).min(1).max(32),
	meet: z.array(z.tuple([tierIndex, tierIndex])).max(16),
	avoid: z.array(drawRule).max(DRAW_RULES.length),
});
export type BracketDraw = z.infer<typeof bracketDraw>;

/** Display metadata for real formats. Stage IDs still identify stages. */
export const stageNameSchema = z.strictObject({
	split: z.enum(["winter", "spring", "summer"]).optional(),
	/** Key suffix in the competition.stage catalog. */
	stage: id,
});

const stage = z.strictObject({
	id: stageId,
	name: stageNameSchema.optional(),
	window,
	/** Consecutive league stages in the same block may play in parallel. */
	parallelGroup: id.optional(),
	/** Earlier split tables in priority order, most recent first. */
	tiebreakHistory: z.array(stageId).min(1).max(31).optional(),
	/** Multiple sources fill the seed list in declaration order. */
	entrants: z.union([source, z.array(source).min(1).max(32)]),
	play,
	/** Pots for groups and Swiss round 1, or a bracket draw (plan 12 §6). */
	draw: z.union([potsDraw, bracketDraw]).optional(),
});

const CRITERIA = [
	"seriesWins",
	"gameDiff",
	"headToHead",
	"gameWins",
	"priorSplitRank",
	"strengthOfVictory",
	"victoryTime",
	"tiebreakerSeries",
	"draw",
] as const;
export const competitionCriterion = z.enum(CRITERIA);

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

type StageFormat = z.infer<typeof stage>;

/** SO11: a bracket draw needs a full power-of-two upper bracket and coherent tiers. */
function checkBracketDraw(
	s: StageFormat,
	path: (string | number)[],
	ctx: z.RefinementCtx,
) {
	const draw = s.draw;
	if (!draw || !("tiers" in draw)) return;
	const play = s.play;
	const size =
		play.type === "singleElim" ||
		(play.type === "doubleElim" && play.lowerSeeds.every((n) => n === 0))
			? play.size
			: 0;
	if (size < 2 || (size & (size - 1)) !== 0)
		return issue(
			ctx,
			path,
			"needs an elimination bracket of 2, 4, 8, 16 or 32",
		);
	const places = draw.tiers.flat().sort((a, b) => a - b);
	if (places.length !== size || places.some((place, i) => place !== i + 1))
		return issue(ctx, [...path, "tiers"], "every place in one tier");
	const used = new Set<number>();
	for (const [a, b] of draw.meet) {
		const [first, second] = [draw.tiers[a - 1], draw.tiers[b - 1]];
		const fits =
			first !== undefined &&
			second !== undefined &&
			a <= b &&
			!used.has(a) &&
			!used.has(b) &&
			(a === b ? first.length % 2 === 0 : first.length <= second.length);
		used.add(a).add(b);
		if (!fits)
			return issue(ctx, [...path, "meet"], "tiers that exist, once each");
	}
	if (new Set(draw.avoid).size !== draw.avoid.length)
		issue(ctx, [...path, "avoid"], "repeated rule");
}

export const competitionSchema = z
	.strictObject({
		id: competitionId,
		kind: z.enum(["league", "international"]),
		stages: z.array(stage).min(1).max(32),
		tiebreak: z.array(competitionCriterion).max(CRITERIA.length),
		/** Bo of the tiebreaker series that decides a tie at a cut. */
		tiebreakerBestOf: bestOf.default(3),
		/** Fearless mode of every series of the competition. */
		fearless: z.enum(["hard", "soft", "off"]).default("hard"),
		slots: z.array(slot).max(16).optional(),
		/** False while the format is not checked against the rulebook. */
		verified: z.boolean(),
		provenance: z
			.strictObject({
				source: z.string().min(1),
				licence: z.string().min(1),
				attribution: z.string().min(1),
				retrievedAt: z.iso.datetime(),
				snapshot: z.string().min(1),
			})
			.optional(),
		unverifiedReasons: z.array(z.string().min(1)).min(1).optional(),
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
			if (play.type === "groups" && play.finalRound) {
				if (
					play.seeding !== "cross" ||
					play.count !== 2 ||
					play.size % 2 ||
					play.inner.rounds !== 1
				)
					issue(
						ctx,
						[...p, "finalRound"],
						"needs two equal cross-groups and a single lap",
					);
				if (play.finalRound.week >= s.window.weeks)
					issue(ctx, [...p, "finalRound", "week"], "outside the stage window");
			}
			if (
				s.tiebreakHistory &&
				(new Set(s.tiebreakHistory).size !== s.tiebreakHistory.length ||
					s.tiebreakHistory.some((id) => id === s.id || !seen.has(id)))
			)
				issue(
					ctx,
					["stages", i, "tiebreakHistory"],
					"requires distinct earlier stages",
				);
			if (
				play.type === "swiss" &&
				Math.min(play.maxRounds ?? Infinity, play.wins + play.losses - 1) >
					play.size - 1
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
			checkBracketDraw(s, ["stages", i, "draw"], ctx);
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
