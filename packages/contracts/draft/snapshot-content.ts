import { z } from "zod";
import { checkDuplicates } from "./content-validation.ts";

const text = z.string().min(1);
const day = z.iso.date();
const timestamp = z.iso.datetime();
const role = z.enum(["top", "jungle", "mid", "bot", "support"]);
const champion = z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/);
const stat = z.int().nonnegative().optional();

export const snapshotLogo = z.strictObject({
	file: text,
	url: z.httpUrl(),
	sha1: z.string().regex(/^[0-9a-f]{40}$/i),
	mime: z.string().startsWith("image/"),
});

const provenance = z.strictObject({
	source: z.literal("Leaguepedia"),
	domain: z.literal("lol.fandom.com"),
	retrievedAt: timestamp,
	licence: z.literal("CC BY-SA 3.0"),
	attribution: text,
	dataDragonVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
	queries: z
		.array(z.strictObject({ url: z.httpUrl(), retrievedAt: timestamp }))
		.min(1),
});
const tournament = z.strictObject({
	id: text,
	name: text,
	startsOn: day.optional(),
	endsOn: day.optional(),
});
const team = z.strictObject({
	id: text,
	name: text,
	short: text.optional(),
	league: text,
	logo: snapshotLogo.optional(),
});

const person = z.strictObject({ id: text, name: text });
const player = person.extend({
	role: role.optional(),
	sub: z.boolean(),
	noGames: z.literal(true).optional(),
});
const coach = person.extend({ role: text });
const roster = z.strictObject({
	tournament: text,
	team: text,
	players: z.array(player),
	coaches: z.array(coach),
});
const seasonPlayer = player.extend({ team: text });

const gameTeam = z.strictObject({
	id: text,
	side: z.enum(["blue", "red"]),
	picks: z.array(champion.nullable()).max(5),
	bans: z.array(champion.nullable()).max(5),
});
const line = z.strictObject({
	player: text,
	team: text,
	champion: champion.optional(),
	role: role.optional(),
	kills: stat,
	deaths: stat,
	assists: stat,
	cs: stat,
	gold: stat,
	damageToChampions: stat,
	visionScore: stat,
});
const game = z.strictObject({
	id: text,
	tournament: text,
	date: timestamp,
	teams: z.tuple([gameTeam, gameTeam]),
	winner: text.optional(),
	lengthSeconds: stat,
	patch: text.optional(),
	draftOrder: z.boolean(),
	lines: z.array(line),
});

export const realSnapshotSchema = z
	.strictObject({
		provenance,
		league: z.strictObject({ id: text, name: text }),
		tournaments: z.array(tournament).min(1),
		teams: z.array(team).min(1),
		rosters: z.array(roster),
		seasonPlayers: z.array(seasonPlayer),
		games: z.array(game).min(1),
	})
	.superRefine((snapshot, ctx) => {
		checkDuplicates(
			ctx,
			"queries",
			snapshot.provenance.queries,
			(query) => query.url,
			"url",
		);
		checkDuplicates(
			ctx,
			"tournaments",
			snapshot.tournaments,
			(row) => row.id,
			"id",
		);
		checkDuplicates(ctx, "teams", snapshot.teams, (row) => row.id, "id");
		checkDuplicates(ctx, "rosters", snapshot.rosters, (row) =>
			JSON.stringify([row.tournament, row.team]),
		);
		checkDuplicates(
			ctx,
			"seasonPlayers",
			snapshot.seasonPlayers,
			(row) => row.id,
			"id",
		);
		checkDuplicates(ctx, "games", snapshot.games, (row) => row.id, "id");

		const teams = new Set(snapshot.teams.map((row) => row.id));
		const tournaments = new Set(snapshot.tournaments.map((row) => row.id));
		const issue = (path: (string | number)[], message: string) =>
			ctx.addIssue({ code: "custom", path, message });
		for (const [index, row] of snapshot.teams.entries()) {
			if (row.league !== snapshot.league.id)
				issue(["teams", index, "league"], "Team belongs to another league");
		}
		for (const [index, row] of snapshot.rosters.entries()) {
			if (!teams.has(row.team) || !tournaments.has(row.tournament))
				issue(["rosters", index], "Unknown roster team or tournament");
		}
		for (const [index, row] of snapshot.seasonPlayers.entries()) {
			if (!teams.has(row.team))
				issue(["seasonPlayers", index, "team"], "Unknown player team");
		}
		for (const [index, row] of snapshot.games.entries()) {
			const [blue, red] = row.teams;
			const sides = new Set([blue.id, red.id]);
			if (
				blue.side !== "blue" ||
				red.side !== "red" ||
				sides.size !== 2 ||
				!teams.has(blue.id) ||
				!teams.has(red.id)
			) {
				issue(
					["games", index, "teams"],
					"Expected two known teams ordered blue, red",
				);
			}
			if (!tournaments.has(row.tournament))
				issue(["games", index, "tournament"], "Unknown game tournament");
			if (row.winner && !sides.has(row.winner))
				issue(["games", index, "winner"], "Winner did not play");
			if (row.lines.some((line) => !sides.has(line.team)))
				issue(["games", index, "lines"], "Player team did not play");
		}
	});

export type RealSnapshot = z.infer<typeof realSnapshotSchema>;
