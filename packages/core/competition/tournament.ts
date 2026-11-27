import {
	type Competition,
	type CoreError,
	type CustomStage,
	competitionSchema,
	type TournamentCreate,
	type TournamentPresetView,
	validateFormat,
} from "@rift-legends/contracts";
import firstStand from "../content/real/formats/first-stand.json";
import msi from "../content/real/formats/msi.json";
import worlds from "../content/real/formats/worlds.json";
import { clamp } from "../math/int";
import { sourcesOf } from "./stage-model";

// Tournament mode (plan 31, Q9 and Q10): a preset or the simple editor
// becomes a season of one competition whose entrants are fixed teams.

type Preset = TournamentPresetView["preset"];
type Slot = TournamentPresetView["slots"][number];
type Failure = { ok: false; error: CoreError };

interface ContentTeam {
	readonly id: string;
	readonly league?: string | undefined;
	readonly seed: number;
}
export type TournamentContents = () => Iterable<{
	readonly match: { readonly teams: readonly ContentTeam[] };
}>;

const PRESETS: Record<Preset, unknown> = {
	"first-stand": firstStand,
	msi,
	worlds,
};

/** Calendar of the simple editor: eight weeks for the first stage, three for the knockout. */
const WINDOWS = [
	{ startWeek: 0, weeks: 8, matchDays: 5, maxSeriesPerDay: 4 },
	{ startWeek: 8, weeks: 3, matchDays: 5, maxSeriesPerDay: 4 },
] as const;
const TIEBREAK = [
	"seriesWins",
	"gameDiff",
	"headToHead",
	"tiebreakerSeries",
	"draw",
] as const;

const fail = (
	code: CoreError["code"],
	params: CoreError["params"] = {},
): Failure => ({ ok: false, error: { code, params } });
const invalid = (path: string) => fail("invalid-format", { path });

/** Every place a preset takes from the leagues, in stage and seed order. */
function presetPlaces(format: Competition) {
	return format.stages.flatMap((stage) =>
		sourcesOf(stage).flatMap((source) =>
			source.kind === "qualified"
				? (source.places ?? []).map((place) => ({ stage: stage.id, ...place }))
				: [],
		),
	);
}

/** Each slot of `preset` with the team of that place in its league, by seed. */
export function presetSlots(
	preset: Preset,
	contents: TournamentContents,
): { ok: true; view: TournamentPresetView } | Failure {
	const places = presetPlaces(competitionSchema.parse(PRESETS[preset]));
	for (const { match } of contents()) {
		const ranked = [...match.teams].sort((a, b) => a.seed - b.seed);
		const slots: Slot[] = [];
		for (const place of places) {
			const team = ranked.filter(({ league }) => league === place.league)[
				place.place - 1
			];
			if (!team) break;
			slots.push({ ...place, team: team.id });
		}
		if (slots.length === places.length)
			return { ok: true, view: { preset, slots } };
	}
	return fail("not-enough-teams", {
		competition: preset,
		needed: places.length,
		available: 0,
	});
}

/** Replaces the places from the leagues with the chosen teams, slot by slot. */
function fixPreset(preset: Preset, teams: readonly string[]): unknown {
	const format = competitionSchema.parse(PRESETS[preset]);
	let next = 0;
	const stages = format.stages.map((stage) => {
		const sources = sourcesOf(stage).map((source) => {
			if (source.kind !== "qualified") return source;
			const count = source.places?.length ?? 0;
			next += count;
			return { kind: "fixed", teams: teams.slice(next - count, next) };
		});
		return {
			...stage,
			entrants: Array.isArray(stage.entrants) ? sources : sources[0],
		};
	});
	return { ...format, stages };
}

const isKnockout = (type: CustomStage["type"]) =>
	type === "singleElim" || type === "doubleElim";
/** Rounds of a knockout of `size` teams: the smallest k with 2^k >= size. */
const rounds = (size: number) => {
	let k = 0;
	while (2 ** k < size) k += 1;
	return k;
};
const STAGE_IDS: Record<CustomStage["type"], string> = {
	roundRobin: "league",
	groups: "groups",
	swiss: "swiss",
	singleElim: "bracket",
	doubleElim: "bracket",
};

/** Keys of the `competition.stage` catalog: the knockout reads «Eliminatoria». */
const STAGE_NAMES: Record<CustomStage["type"], string> = {
	roundRobin: "league",
	groups: "groups",
	swiss: "swiss",
	singleElim: "elimination",
	doubleElim: "elimination",
};

/** The plan 12 block for one stage of the editor, or `undefined` if it cannot be built. */
function playOf({ type, bestOf, groups }: CustomStage, size: number) {
	switch (type) {
		case "roundRobin":
			return { type, size, rounds: 1, bestOf };
		case "groups":
			return {
				type,
				size,
				count: groups ?? 2,
				seeding: "snake",
				inner: { rounds: 1, bestOf },
			};
		case "swiss": {
			// Three wins or losses as at Worlds, fewer when the field is small.
			const full = 2 ** rounds(size) === size ? rounds(size) : rounds(size) - 1;
			const wins = clamp(full, 1, 3);
			return {
				type,
				size,
				wins,
				losses: wins,
				bestOf,
				decisiveBestOf: bestOf,
				round1: "pots",
				avoid: ["region", "rematch"],
			};
		}
		case "singleElim":
			return { type, size, bestOf: Array(rounds(size)).fill(bestOf) };
		case "doubleElim": {
			// A full bracket only: upper round r drops its losers to lower round 2r - 1.
			const k = rounds(size);
			if (2 ** k !== size || k < 2) return undefined;
			return {
				type,
				size,
				upper: Array(k).fill(bestOf),
				lower: Array(2 * (k - 1)).fill(bestOf),
				drop: Array.from({ length: k }, (_, r) =>
					Array(size / 2 ** (r + 1)).fill(r === 0 ? 0 : 2 * r - 1),
				),
				lowerSeeds: [],
				grandFinal: bestOf,
				reset: false,
			};
		}
	}
}

function customFormat(
	stages: readonly CustomStage[],
	teams: readonly string[],
): { ok: true; format: unknown } | Failure {
	const [first, second] = stages;
	if (!first) return invalid("stages");
	if (second && (isKnockout(first.type) || !isKnockout(second.type)))
		return invalid("stages.1");
	if (second && second.size === undefined) return invalid("stages.1.size");
	const built = [];
	for (const [index, stage] of stages.entries()) {
		const size = index === 0 ? teams.length : (stage.size as number);
		const play = playOf(stage, size);
		if (!play) return invalid(`stages.${index}.play.size`);
		built.push({
			id: index === 0 ? STAGE_IDS[stage.type] : "playoffs",
			name: { stage: STAGE_NAMES[stage.type] },
			window: WINDOWS[index],
			entrants:
				index === 0
					? { kind: "fixed", teams }
					: {
							kind: "standing",
							stage: STAGE_IDS[first.type],
							from: 1,
							to: size,
						},
			play,
		});
	}
	return {
		ok: true,
		format: {
			id: "custom",
			kind: "international",
			stages: built,
			tiebreak: TIEBREAK,
			verified: true,
		},
	};
}

/** The `season.create` body of a tournament, or the error to answer. */
export function tournamentSeason(
	payload: TournamentCreate,
	contents: TournamentContents,
) {
	const { format, year, seed, humanTeam, fearless } = payload;
	let teams = payload.teams;
	if (format.kind === "preset") {
		const slots = presetSlots(format.preset, contents);
		if (!teams) {
			if (!slots.ok) return slots;
			teams = slots.view.slots.map(({ team }) => team);
		} else if (slots.ok && teams.length !== slots.view.slots.length)
			return invalid("teams");
	}
	if (!teams) return invalid("teams");
	const repeated = teams.findIndex((team, i) => teams.indexOf(team) !== i);
	if (repeated !== -1) return invalid(`teams.${repeated}`);

	let known: ReadonlyMap<string, ContentTeam> = new Map();
	for (const { match } of contents()) {
		const set = new Map(match.teams.map((team) => [team.id, team]));
		const count = teams.filter((id) => set.has(id)).length;
		if (count > teams.filter((id) => known.has(id)).length) known = set;
	}
	const unknown = teams.find((id) => !known.has(id));
	if (unknown !== undefined) return fail("unknown-team", { team: unknown });

	const raw =
		format.kind === "preset"
			? { ok: true as const, format: fixPreset(format.preset, teams) }
			: customFormat(format.stages, teams);
	if (!raw.ok) return raw;
	const checked = validateFormat({ ...(raw.format as object), fearless });
	if (!checked.ok) return checked;
	return {
		ok: true as const,
		season: {
			year,
			seed,
			competitions: [checked.competition],
			teams: teams.map((id) => {
				const team = known.get(id) as ContentTeam;
				const league = team.league ?? "custom";
				return { id, competition: league, region: league, rank: team.seed };
			}),
			...(humanTeam !== undefined && { humanTeam }),
		},
	};
}
