import type { AiContent, MatchContent } from "@rift-legends/contracts";
import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { ChampionKit } from "./champion-kit-source.ts";
import {
	countsFor,
	rankTiers,
	recordPick,
	roles,
	type SeasonPresence,
	scorePositions,
	tierSeasons,
} from "./champion-presence.ts";
import {
	laneHits,
	pairPriorGames,
	score,
	synergyHits,
	teamHits,
} from "./champion-rules.ts";
import { championProfile } from "./curated-champions.ts";
import { key, orderBy } from "./normalization.ts";

type Champion = AiContent["champions"][number] &
	MatchContent["champions"][number];
type Game = RealSnapshot["games"][number];
type Role = (typeof roles)[number];

export interface CatalogChampion {
	id: string;
	key: number;
	classes: string[];
}

function teamPicks(game: Game, team: Game["teams"][number]) {
	const picks = new Map<string, Set<Role>>();
	for (const id of team.picks) {
		if (id) picks.set(id, new Set());
	}
	for (const line of game.lines) {
		if (line.team !== team.id || !line.champion) continue;
		const roles = picks.get(line.champion) ?? new Set<Role>();
		if (line.role) roles.add(line.role);
		picks.set(line.champion, roles);
	}
	return picks;
}

function onlyRole(candidates: ReadonlySet<Role>) {
	return candidates.size === 1 ? [...candidates][0] : undefined;
}

function inRole(picks: ReturnType<typeof teamPicks>, role: Role) {
	const candidates = [...picks].filter(([, roles]) => roles.has(role));
	const [id, roles] = candidates[0] ?? [];
	return candidates.length === 1 && roles?.size === 1 ? id : undefined;
}

type Samples = Map<string, { games: number; wins: number }>;

function recordPair(pairs: Samples, id: string, won: boolean) {
	const row = pairs.get(id) ?? { games: 0, wins: 0 };
	row.games++;
	if (won) row.wins++;
	pairs.set(id, row);
}

function recordAllies(
	pairs: Samples,
	picks: ReturnType<typeof teamPicks>,
	won: boolean,
) {
	const ids = [...picks.keys()].sort();
	for (const [index, a] of ids.entries()) {
		for (const b of ids.slice(index + 1)) recordPair(pairs, key(a, b), won);
	}
}

function recordOpponents(
	pairs: Samples,
	blue: string,
	red: string,
	blueWon: boolean,
	role?: Role,
) {
	if (blue === red) return;
	const [a, b, won] = blue < red ? [blue, red, blueWon] : [red, blue, !blueWon];
	recordPair(pairs, role ? key(a, b, role) : key(a, b), won);
}

const yearOf = (date: string) => Number(date.slice(0, 4));

function observations(
	catalog: readonly CatalogChampion[],
	games: readonly Game[],
	current: number,
) {
	const ids = new Set(catalog.map(({ id }) => id));
	const seasons = new Map<number, SeasonPresence>();
	const opponents: Samples = new Map();
	const teamOpponents: Samples = new Map();
	const allies: Samples = new Map();
	const ensureKnown = (id: string) => {
		if (!ids.has(id))
			throw new Error(`Snapshot champion missing from catalog: ${id}`);
	};
	for (const game of games) {
		const year = yearOf(game.date);
		const season = seasons.get(year) ?? {
			year,
			games: 0,
			champions: new Map(),
		};
		seasons.set(year, season);
		season.games++;
		const [blue, red] = game.teams;
		const bluePicks = teamPicks(game, blue);
		const redPicks = teamPicks(game, red);
		for (const id of new Set([...blue.bans, ...red.bans])) {
			if (!id) continue;
			ensureKnown(id);
			countsFor(season, id).bans++;
		}
		for (const picks of [bluePicks, redPicks]) {
			for (const [id, candidates] of picks) {
				ensureKnown(id);
				recordPick(season, id, onlyRole(candidates));
			}
		}
		if (!game.winner || year !== current) continue;
		const blueWon = game.winner === blue.id;
		recordAllies(allies, bluePicks, blueWon);
		recordAllies(allies, redPicks, !blueWon);
		const lanes = roles.map((role) => ({
			role,
			a: inRole(bluePicks, role),
			b: inRole(redPicks, role),
		}));
		for (const { role, a, b } of lanes) {
			if (!a) continue;
			if (b) recordOpponents(opponents, a, b, blueWon, role);
			for (const enemy of lanes) {
				if (enemy.role !== role && enemy.b)
					recordOpponents(teamOpponents, a, enemy.b, blueWon);
			}
		}
	}
	return { seasons, opponents, teamOpponents, allies };
}

interface ContentOptions {
	priorGames?: number | undefined;
	season?: number | undefined;
	history?: readonly SeasonPresence[] | undefined;
	/** Kit facts from the game data (#340); champions without one use estimates. */
	kits?: ReadonlyMap<string, ChampionKit> | undefined;
}

/** Ultimate cooldown by rank when the game data has none (#622). */
const estimatedUltCooldownTenths = [1200, 1000, 800] as const;

export function deriveChampionContent(
	catalog: readonly CatalogChampion[],
	games: readonly Game[],
	options: ContentOptions = {},
) {
	const {
		priorGames = pairPriorGames,
		season = games.reduce((year, game) => Math.max(year, yearOf(game.date)), 0),
		history = [],
		kits = new Map<string, ChampionKit>(),
	} = options;
	if (!Number.isSafeInteger(priorGames) || priorGames < 1)
		throw new Error("Pair prior games must be a positive integer");
	const { seasons, opponents, teamOpponents, allies } = observations(
		catalog,
		games,
		season,
	);
	for (const past of history) {
		if (past.year < season && !seasons.has(past.year))
			seasons.set(past.year, past);
	}
	const presence = tierSeasons(seasons.values(), season);
	const scored = orderBy(catalog, ({ id }) => id).map(({ id, classes }) => {
		const profile = championProfile(id, classes, kits.get(id));
		return { id, profile, scores: scorePositions(id, profile, presence) };
	});
	const tiers = new Map(
		roles.map((role) => [
			role,
			rankTiers(
				scored.flatMap(({ id, scores }) => {
					const row = scores.find((position) => position.role === role);
					return row ? [{ id, score: row.score, samples: row.samples }] : [];
				}),
			),
		]),
	);
	const entries = scored.map(({ id, profile, scores }) => {
		const { damage, power, archetypes, cc, mobility, frontline } = profile;
		const kit = kits.get(id);
		const ultCooldown = kit?.ultCooldown;
		const champion: Champion = {
			id,
			name: id,
			positions: scores.map(({ role }) => ({
				role,
				tier: tiers.get(role)?.get(id) ?? "D",
			})),
			damage,
			power,
			archetypes: [...archetypes],
			cc,
			mobility,
			frontline,
			kit: [...profile.kit],
			ccKinds: [...profile.ccKinds],
			split: [...profile.split],
			ultCooldownTenths: ultCooldown
				? (ultCooldown.map((seconds) => Math.round(seconds * 10)) as [
						number,
						number,
						number,
					])
				: [...estimatedUltCooldownTenths],
			traitSources: {
				ultCooldownTenths: ultCooldown
					? kit?.ultRule
						? "rule"
						: "source"
					: "estimated",
				ccKinds: profile.sources.cc,
				split: profile.sources.split,
				kit: profile.sources.kit,
			},
		};
		return {
			champion,
			profile,
			roles: new Set(champion.positions.map(({ role }) => role)),
		};
	});
	const matchups: AiContent["matchups"] = [];
	const counters: NonNullable<AiContent["counters"]> = [];
	const synergies: AiContent["synergies"] = [];
	for (const [index, left] of entries.entries()) {
		const a = left.champion.id;
		for (const right of entries.slice(index + 1)) {
			const b = right.champion.id;
			for (const role of left.roles) {
				if (!right.roles.has(role)) continue;
				const lane = score(
					laneHits(left.profile, right.profile, role),
					20,
					priorGames,
					opponents.get(key(a, b, role)),
				);
				if (lane.value) {
					matchups.push(
						{ champion: a, against: b, role, ...lane },
						{ champion: b, against: a, role, ...lane, value: -lane.value },
					);
				}
			}
			const teamRules = teamHits(left.profile, right.profile);
			if (teamRules.length) {
				const team = score(
					teamRules,
					12,
					priorGames,
					teamOpponents.get(key(a, b)),
				);
				if (team.value)
					counters.push(
						{ champion: a, against: b, ...team },
						{ champion: b, against: a, ...team, value: -team.value },
					);
			}
			if (
				left.roles.size === 1 &&
				right.roles.size === 1 &&
				[...left.roles].some((role) => right.roles.has(role))
			)
				continue;
			const duo = score(
				synergyHits(left.profile, right.profile, left.roles, right.roles),
				12,
				priorGames,
				allies.get(key(a, b)),
			);
			if (duo.value > 0) synergies.push({ a, b, ...duo });
		}
	}
	const champions = entries.map(({ champion }) => champion);
	return {
		champions,
		matchups: orderBy(matchups, ({ champion, against, role }) =>
			key(champion, against, role),
		),
		counters: orderBy(counters, ({ champion, against }) =>
			key(champion, against),
		),
		synergies,
		traits: entries.map(({ champion, profile }) => ({
			id: champion.id,
			sources: profile.sources,
			estimatedKit: profile.estimatedKit,
		})),
		estimated: entries
			.filter(({ profile }) => profile.estimate)
			.map(({ champion }) => champion.id),
		classFallbacks: entries
			.filter(({ profile }) => profile.estimate === "class")
			.map(({ champion }) => champion.id),
		priorGames,
	};
}
