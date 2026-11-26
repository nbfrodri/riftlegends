import { competitionViews } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season, teams, window } from "./season.fixtures";

type Core = ReturnType<typeof client>;
type Fact = Record<string, unknown> & { type: string };

const league = {
	...season.competitions[0],
	stages: [
		{
			id: "split",
			window,
			entrants: { kind: "fixed", teams: teams.map(({ id }) => id) },
			play: { type: "roundRobin", size: 4, rounds: 1, bestOf: 1 },
		},
	],
};
const roundRobin = { ...season, competitions: [league] };

const view = (core: Core, kind: string, params: object = {}) => {
	const result = core.query(kind, params);
	if (!result.ok || !("view" in result))
		throw new Error(`${kind}: ${JSON.stringify(result)}`);
	return result.view;
};

const overview = (core: Core) =>
	competitionViews.overview.parse(view(core, "season.overview"));

/** Plays the whole season and returns every fact in order. */
function playAll(core: Core) {
	const facts: Fact[] = [];
	for (let day = overview(core).day; day !== null; day = overview(core).day) {
		facts.push(
			...(accepted(core.send("season.playDay", { day })).facts as Fact[]),
		);
	}
	return facts;
}

/** The facts of each series, keyed by `[a, b]`, split at `competition.seriesRecorded`. */
function bySeries(facts: Fact[]) {
	const out: { teams: string[]; facts: Fact[] }[] = [];
	let current: Fact[] = [];
	for (const fact of facts) {
		current.push(fact);
		if (fact.type === "competition.seriesRecorded") {
			out.push({ teams: fact.teams as string[], facts: current });
			current = [];
		}
	}
	return out;
}

test("Q1: before day 0 every competition and stage is pending, without a leader", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	expect(overview(core)).toEqual({
		year: 2026,
		day: 0,
		competitions: [
			{
				id: "league",
				status: "pending",
				stages: [
					{
						stage: "split",
						play: "roundRobin",
						status: "pending",
						startDay: expect.any(Number),
						endDay: expect.any(Number),
					},
				],
			},
		],
	});
});

test("Q1: goes live with a leader, then finishes with a champion and no next day", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const first = overview(core).day as number;
	accepted(core.send("season.playDay", { day: first }));
	const live = overview(core);
	expect(live.competitions[0]).toMatchObject({
		status: "live",
		stages: [{ stage: "split", status: "live" }],
		leader: { team: expect.any(String), seriesWins: expect.any(Number) },
	});
	expect(live.competitions[0]).not.toHaveProperty("champion");
	expect(live.day).toBeGreaterThan(first);
	playAll(core);
	const done = overview(core);
	const table = view(core, "competition.standings", {
		competition: "league",
		stage: "split",
	}) as { rows: { team: string }[] };
	expect(done.day).toBeNull();
	expect(done.competitions[0]).toMatchObject({
		status: "finished",
		stages: [{ status: "finished" }],
		champion: table.rows[0]?.team,
	});
});

test("Q2: standings exist before any series, all at zero in seed order", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const table = view(core, "competition.standings", {
		competition: "league",
		stage: "split",
	}) as { rows: Record<string, unknown>[] };
	expect(table.rows.map(({ team }) => team)).toEqual(teams.map(({ id }) => id));
	for (const row of table.rows) {
		expect(row).toMatchObject({
			seriesWins: 0,
			seriesLosses: 0,
			gameWins: 0,
			gameLosses: 0,
			explanation: { criterion: "none" },
		});
	}
});

test("Q2: standings count the series played so far, not only the final table", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const day = overview(core).day as number;
	const facts = accepted(core.send("season.playDay", { day })).facts as Fact[];
	const recorded = facts.filter(
		({ type }) => type === "competition.seriesRecorded",
	);
	const table = view(core, "competition.standings", {
		competition: "league",
		stage: "split",
	}) as { rows: { seriesWins: number; seriesLosses: number }[] };
	const wins = table.rows.reduce((sum, row) => sum + row.seriesWins, 0);
	expect(wins).toBe(recorded.length);
	expect(table.rows.reduce((sum, row) => sum + row.seriesLosses, 0)).toBe(
		recorded.length,
	);
	expect(recorded.length).toBeGreaterThan(0);
	expect(facts.some(({ type }) => type === "competition.stageFinished")).toBe(
		recorded.length === 6,
	);
});

test("Q4: schedule filters by team and every series carries its id", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const all = view(core, "competition.schedule", {}) as {
		id: string;
		teams: string[];
		day: number;
	}[];
	const mine = view(core, "competition.schedule", {
		team: "forge",
	}) as typeof all;
	expect(all).toHaveLength(6);
	expect(mine).toHaveLength(3);
	for (const slot of mine) expect(slot.teams).toContain("forge");
	expect(new Set(all.map(({ id }) => id)).size).toBe(6);
	const day = mine[0]?.day as number;
	expect(
		view(core, "competition.schedule", {
			team: "forge",
			competition: "league",
			fromDay: day,
			toDay: day,
		}),
	).toEqual(mine.filter((slot) => slot.day === day));
	expect(view(core, "competition.schedule", { team: "nobody" })).toEqual([]);
});

test("Q5: a team without series has empty statistics, not an error", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const profile = competitionViews.teamProfile.parse(
		view(core, "team.profile", { team: "forge" }),
	);
	expect(profile.team.id).toBe("forge");
	expect(profile.players.length).toBeGreaterThan(0);
	expect(profile.series).toEqual([]);
	expect(profile.recent).toEqual([]);
	expect(profile.streak).toBeNull();
	expect(profile.stats).toEqual({
		seriesWon: 0,
		seriesLost: 0,
		gamesWon: 0,
		gamesLost: 0,
		averageDuration: null,
		players: [],
		champions: [],
	});
});

test("Q5: the profile aggregates the recorded series, in the order they were played", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const facts = playAll(core);
	const profile = competitionViews.teamProfile.parse(
		view(core, "team.profile", { team: "forge" }),
	);
	const mine = bySeries(facts).filter(({ teams: pair }) =>
		pair.includes("forge"),
	);
	expect(profile.series).toHaveLength(mine.length);
	expect(profile.recent).toEqual(profile.series.slice(0, 5));
	const oracle = mine.map(({ facts: log }) => {
		const recorded = log.at(-1) as Fact;
		const index = (recorded.teams as string[]).indexOf("forge");
		const score = recorded.score as number[];
		return { won: recorded.winner === "forge", own: score[index] };
	});
	expect(profile.series.map(({ won }) => won)).toEqual(
		oracle.map(({ won }) => won).reverse(),
	);
	expect(profile.stats.seriesWon).toBe(oracle.filter(({ won }) => won).length);
	expect(profile.stats.seriesLost).toBe(
		oracle.filter(({ won }) => !won).length,
	);
	const ended = mine.flatMap(({ facts: log }) =>
		log.filter(({ type }) => type === "match.ended"),
	);
	expect(profile.stats.gamesWon + profile.stats.gamesLost).toBe(ended.length);
	const durations = ended.map(({ duration }) => duration as number);
	expect(profile.stats.averageDuration).toBe(
		Math.floor(durations.reduce((a, b) => a + b, 0) / durations.length),
	);
	type Line = { team: string; player: string; kills: number };
	const lines = ended.flatMap(({ players }) =>
		(players as Line[]).filter(({ team }) => team === "forge"),
	);
	const kills = (player: string) =>
		lines
			.filter((line) => line.player === player)
			.reduce((sum, line) => sum + line.kills, 0);
	for (const line of profile.stats.players)
		expect(line.kills).toBe(kills(line.player));
	expect(profile.stats.players.reduce((sum, line) => sum + line.games, 0)).toBe(
		lines.length,
	);
	expect(profile.stats.champions.length).toBeLessThanOrEqual(5);
	const top = profile.stats.champions[0];
	expect(top?.games).toBe(
		Math.max(...profile.stats.champions.map(({ games }) => games)),
	);
	const results = profile.series.map(({ won }) => won);
	let length = 0;
	while (length < results.length && results[length] === results[0]) length++;
	expect(profile.streak).toEqual({
		result: results[0] ? "won" : "lost",
		length,
	});
});

test("Q5: an unknown team is rejected", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	expect(core.query("team.profile", { team: "nobody" })).toMatchObject({
		ok: false,
		error: { code: "unknown-team" },
	});
});

test("Q6: series.summary and match.view open a played series by its id", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const facts = playAll(core);
	const slots = view(core, "competition.schedule", {}) as {
		id: string;
		teams: string[];
		status: string;
	}[];
	expect(slots.every(({ status }) => status === "played")).toBe(true);
	const logs = bySeries(facts);
	for (const slot of slots) {
		const log = logs.find(
			({ teams: pair }) => pair.join() === slot.teams.join(),
		);
		if (!log) throw new Error("series not recorded");
		const ended = log.facts.filter(({ type }) => type === "match.ended");
		const summary = view(core, "series.summary", { series: slot.id }) as {
			mvp: { team: string } | null;
			lanes: { game: number }[];
		};
		expect(summary.lanes).toHaveLength(ended.length);
		expect(summary.mvp?.team).toBe((log.facts.at(-1) as Fact).winner);
		const game = view(core, "match.view", { series: slot.id, game: 1 }) as {
			game: number;
			facts: Fact[];
			snapshots: unknown[];
		};
		expect(game.game).toBe(1);
		// Replaying the series gives back the very facts that were recorded.
		// The recorded facts also carry the position they took in the log.
		const { position: _, ...recorded } = ended[0] as Fact;
		expect(game.facts.find(({ type }) => type === "match.ended")).toEqual(
			recorded,
		);
		expect(game.snapshots.length).toBeGreaterThan(0);
	}
});

test("Q6: a series that is not played yet, or not known, is unknown-series", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const [slot] = view(core, "competition.schedule", {}) as { id: string }[];
	for (const series of [slot?.id as string, "nope"]) {
		expect(core.query("series.summary", { series })).toMatchObject({
			ok: false,
			error: { code: "unknown-series" },
		});
		expect(core.query("match.view", { series, game: 1 })).toMatchObject({
			ok: false,
			error: { code: "unknown-series" },
		});
	}
});

test("Q6: a game that the series did not play is game-not-played", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	playAll(core);
	const [slot] = view(core, "competition.schedule", {}) as { id: string }[];
	expect(core.query("match.view", { series: slot?.id, game: 2 })).toMatchObject(
		{ ok: false, error: { code: "game-not-played" } },
	);
});

test("Q3: the bracket gives each series its teams, origin and result as it is played", () => {
	const core = client();
	accepted(
		core.send("season.create", {
			...season,
			competitions: [
				{
					...league,
					stages: [
						{
							...league.stages[0],
							play: { type: "singleElim", size: 4, bestOf: [1, 1] },
						},
					],
				},
			],
		}),
	);
	type Match = {
		id: string;
		round: number;
		teamA: string | null;
		teamB: string | null;
		status: string;
		winner: string | null;
		from: { kind: string; rank?: number; match?: string }[];
	};
	const bracket = () =>
		view(core, "competition.bracket", {
			competition: "league",
			stage: "split",
		}) as { matches: Match[]; champion: string | null };
	const before = bracket();
	const [first, second, final] = before.matches;
	expect(before.matches).toHaveLength(3);
	expect(first?.from).toEqual([
		{ kind: "seed", rank: 1 },
		{ kind: "seed", rank: 4 },
	]);
	expect(final).toMatchObject({
		status: "waiting",
		teamA: null,
		teamB: null,
		from: [
			{ kind: "winner", match: first?.id },
			{ kind: "winner", match: second?.id },
		],
	});
	playAll(core);
	const after = bracket();
	const [semi, , decider] = after.matches;
	expect(semi?.status).toBe("done");
	expect(after.champion).toBe(decider?.winner);
	expect([decider?.teamA, decider?.teamB]).toContain(semi?.winner);
});

test("Q3: a played bracket series gives its score in the order of its teams and the id that opens it", () => {
	const core = client();
	accepted(
		core.send("season.create", {
			...season,
			competitions: [
				{
					...league,
					stages: [
						{
							...league.stages[0],
							play: { type: "singleElim", size: 4, bestOf: [3, 3] },
						},
					],
				},
			],
		}),
	);
	const ref = { competition: "league", stage: "split" };
	const bracket = () =>
		competitionViews.bracket.parse(view(core, "competition.bracket", ref));
	expect(bracket().matches.some((match) => "score" in match)).toBe(false);
	playAll(core);
	const schedule = view(core, "competition.schedule", {
		competition: ref.competition,
	}) as {
		id: string;
		teams: [string, string];
		score: [number, number];
	}[];
	for (const match of bracket().matches) {
		const slot = schedule.find(({ id }) => id === match.series);
		expect(slot).toBeDefined();
		const [a, b] = match.score ?? [];
		const ordered =
			slot?.teams[0] === match.teamA
				? slot?.score
				: [slot?.score[1], slot?.score[0]];
		expect([a, b]).toEqual(ordered);
		expect(Math.max(a ?? 0, b ?? 0)).toBe(2);
		expect((a ?? 0) > (b ?? 0) ? match.teamA : match.teamB).toBe(match.winner);
	}
});

test("Q4: a bracket series names its bracket match, so a pending team can say where it comes from", () => {
	const core = client();
	accepted(
		core.send("season.create", {
			...season,
			competitions: [
				{
					...league,
					stages: [
						{
							...league.stages[0],
							play: { type: "singleElim", size: 4, bestOf: [1, 1] },
						},
					],
				},
			],
		}),
	);
	const schedule = competitionViews.schedule.parse(
		view(core, "competition.schedule", {}),
	);
	const bracket = competitionViews.bracket.parse(
		view(core, "competition.bracket", {
			competition: "league",
			stage: "split",
		}),
	);
	expect(schedule.map(({ match }) => match).sort()).toEqual(
		bracket.matches.map(({ id }) => id).sort(),
	);
	const final = schedule.find(({ teams }) => teams.includes(null));
	expect(final?.match).toBe(bracket.matches.at(-1)?.id);
});

test("Q4: a round robin series has no bracket match", () => {
	const core = client();
	accepted(core.send("season.create", roundRobin));
	const schedule = competitionViews.schedule.parse(
		view(core, "competition.schedule", {}),
	);
	expect(schedule.length).toBeGreaterThan(0);
	for (const slot of schedule) expect(slot.match).toBeUndefined();
});
