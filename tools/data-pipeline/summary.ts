import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type RealSnapshot,
	realSnapshotSchema,
} from "@rift-legends/contracts/real-snapshot";

type League = Pick<
	RealSnapshot,
	"league" | "teams" | "seasonPlayers" | "games"
>;

function markdown(value: string) {
	return value
		.replace(/\s+/g, " ")
		.replace(/&/g, "&amp;")
		.replace(/@/g, "&#64;")
		.replace(/[\\`*_{}[\]()#+.!|<>~]/g, "\\$&");
}

function index(leagues: readonly League[]) {
	const teams = new Map<string, string>();
	const players = new Map<
		string,
		{ name: string; team: string; club: string }
	>();
	const champions = new Set<string>();
	const games = new Map<string, number>();
	for (const {
		league,
		teams: clubs,
		seasonPlayers,
		games: matches,
	} of leagues) {
		const names = new Map(clubs.map(({ id, name }) => [id, markdown(name)]));
		const label = (id: string) =>
			`${names.get(id) ?? markdown(id)} (${markdown(league.id)})`;
		for (const { id } of clubs) teams.set(id, label(id));
		for (const { id, name, team } of seasonPlayers)
			players.set(id, { name, team, club: label(team) });
		for (const game of matches) {
			for (const side of game.teams) {
				for (const id of [...side.picks, ...side.bans])
					if (id) champions.add(id);
			}
			for (const { champion } of game.lines)
				if (champion) champions.add(champion);
		}
		games.set(league.id, matches.length);
	}
	return { teams, players, champions, games };
}

function section(title: string, items: string[]) {
	return [
		`### ${title} (${items.length})`,
		"",
		...(items.length ? items.sort().map((item) => `- ${item}`) : ["Ninguno."]),
		"",
	];
}

export function summarize(before: readonly League[], after: readonly League[]) {
	const previous = index(before);
	const current = index(after);
	const transfers: string[] = [];
	for (const [id, player] of current.players) {
		const old = previous.players.get(id);
		if (old && old.team !== player.team)
			transfers.push(`${markdown(player.name)}: ${old.club} → ${player.club}`);
	}
	const newTeams = [...current.teams]
		.filter(([id]) => !previous.teams.has(id))
		.map(([, name]) => name);
	const newChampions = [...current.champions]
		.filter((id) => !previous.champions.has(id))
		.map(markdown);
	const leagues = [
		...new Set([...previous.games.keys(), ...current.games.keys()]),
	].sort();
	return [
		...section("Fichajes", transfers),
		...section("Equipos nuevos", newTeams),
		...section("Campeones nuevos en partidas", newChampions),
		"### Partidas por liga",
		"",
		"| Liga | Antes | Ahora |",
		"| --- | ---: | ---: |",
		...leagues.map(
			(id) =>
				`| ${markdown(id)} | ${previous.games.get(id) ?? 0} | ${current.games.get(id) ?? 0} |`,
		),
	].join("\n");
}

async function readLeagues(directory: string) {
	const files = (await readdir(directory))
		.filter((file) => file.endsWith(".json") && file !== "logos.json")
		.sort();
	return Promise.all(
		files.map(async (file) => {
			const body = await readFile(join(directory, file), "utf8");
			return realSnapshotSchema.parse(JSON.parse(body));
		}),
	);
}

if (import.meta.main) {
	const [before, after] = process.argv.slice(2);
	if (!before || !after)
		throw new Error("Usage: node summary.ts <before-dir> <after-dir>");
	const [previous, current] = await Promise.all([
		readLeagues(before),
		readLeagues(after),
	]);
	console.log(summarize(previous, current));
}
