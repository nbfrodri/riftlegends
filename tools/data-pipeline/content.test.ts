import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { aiContent, matchContent } from "@rift-legends/contracts";
import { isBirthDate } from "@rift-legends/contracts/age";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { expect, test } from "vitest";
import { buildContent } from "./content.ts";
import { parseHistory } from "./history.ts";
import { buildPlayerTeamContent } from "./player-team-content.ts";
import { leagues } from "./scope.ts";

const dir = fileURLToPath(
	new URL("../../packages/core/content/real/", import.meta.url),
);
const read = async (file: string) =>
	JSON.parse(await readFile(`${dir}${file}`, "utf8"));

test("career history improves ratings and leaves players without history unchanged", async () => {
	const snapshots = await Promise.all(
		leagues.map(async ({ id }) =>
			realSnapshotSchema.parse(await read(`${id.toLowerCase()}.json`)),
		),
	);
	const { players: baseline } = buildPlayerTeamContent(snapshots);
	const careers = new Set(
		parseHistory(await readFile(`${dir}history.json`, "utf8")).players.map(
			({ id }) => id,
		),
	);
	const players: typeof baseline = await read("players.json");
	const levels = new Map(baseline.map(({ id, level }) => [id, level]));
	expect(
		players.some(
			({ id, level }) =>
				careers.has(id) && level > (levels.get(id) ?? Infinity),
		),
	).toBe(true);
	if (snapshots.every(({ season }) => season === undefined))
		expect(
			players.find(({ handle }) => handle === "Faker")?.level,
		).toBeGreaterThanOrEqual(80);
	const withoutHistory = baseline.filter(({ id }) => !careers.has(id));
	expect(withoutHistory.length).toBeGreaterThan(0);
	expect(
		players
			.filter(({ id }) => !careers.has(id))
			.map(({ nationality: _n, birthDate: _b, ...player }) => player),
	).toEqual(
		withoutHistory.map(
			({ nationality: _n, birthDate: _b, ...player }) => player,
		),
	);
});

test("no real player with a career is rated above 94", async () => {
	const careers = new Set(
		parseHistory(await readFile(`${dir}history.json`, "utf8")).players.map(
			({ id }) => id,
		),
	);
	const players: {
		id: string;
		level: number;
		attributes: Record<string, number>;
	}[] = await read("players.json");
	for (const { id, level, attributes } of players.filter((p) =>
		careers.has(p.id),
	)) {
		expect(level, id).toBeLessThanOrEqual(94);
		expect(Math.max(...Object.values(attributes)), id).toBeLessThanOrEqual(95);
	}
});

test("the committed players and teams are what the snapshot produces", async () => {
	for (const [file, body] of Object.entries(await buildContent()))
		expect(body, file).toBe(await readFile(`${dir}${file}`, "utf8"));
});

test("the cached Leaguepedia nationality reaches real player content", async () => {
	const files = await buildContent();
	const players = JSON.parse(files["players.json"]);
	expect(
		players.find(({ id }: { id: string }) => id === "Faker"),
	).toHaveProperty("nationality", "KR");
});

test("the cached Leaguepedia birth date reaches real player content", async () => {
	const players = JSON.parse((await buildContent())["players.json"]);
	expect(
		players.find(({ id }: { id: string }) => id === "Faker"),
	).toHaveProperty("birthDate", "1996-05-07");
});

test("most real players have a birth date, and every one is valid", async () => {
	const players: { birthDate?: string }[] = await read("players.json");
	const known = players.filter((player) => player.birthDate);
	expect(known.length / players.length).toBeGreaterThanOrEqual(0.9);
	for (const { birthDate } of known)
		expect(isBirthDate(birthDate ?? ""), birthDate).toBe(true);
});

test("older snapshots without nationality data still produce player content", async () => {
	const legacy = await mkdtemp(join(tmpdir(), "rift-legacy-content-"));
	try {
		const files = [
			...leagues.map(({ id }) => `${id.toLowerCase()}.json`),
			"history.json",
		];
		await Promise.all(
			files.map((file) => copyFile(join(dir, file), join(legacy, file))),
		);
		const content = await buildContent(legacy);
		expect(content["players.json"]).toContain('"id":"Faker"');
		expect(content["players.json"]).not.toContain('"nationality"');
		expect(content["players.json"]).not.toContain('"birthDate"');
	} finally {
		await rm(legacy, { recursive: true, force: true });
	}
});

test("each league keeps its split teams and drops one-split guests (#368)", async () => {
	const teams: { id: string; league: string }[] = await read("teams.json");
	const count = (league: string) =>
		teams.filter((team) => team.league === league).length;
	expect(count("LEC")).toBe(10);
	expect(count("LPL")).toBe(14);
	expect(teams.some((team) => team.id === "Los Ratones")).toBe(false);
	expect(teams.some((team) => team.id === "Karmine Corp Blue")).toBe(false);
});

test("real players and teams have the shape of the fictional content", async () => {
	const players: Record<string, unknown>[] = await read("players.json");
	const teams: { id: string; seed: number }[] = await read("teams.json");
	const draft = aiContent.shape.players.element;
	const match = matchContent.shape.players.element;
	for (const player of players) {
		const { attributes, leader, mastery, ...rest } = player;
		expect(draft.safeParse(rest).success, JSON.stringify(rest)).toBe(true);
		expect(
			match.safeParse({
				id: (rest as { id: string }).id,
				attributes,
				leader,
				mastery,
			}).success,
		).toBe(true);
	}
	for (const team of teams)
		expect(
			matchContent.shape.teams.element.safeParse(team).success,
			team.id,
		).toBe(true);
	expect(new Set(teams.map((team) => team.seed)).size).toBe(teams.length);
	for (const { id } of teams) {
		const roster = players.filter((p) => p.team === id);
		expect(new Set(roster.map((p) => p.role))).toEqual(
			new Set(["top", "jungle", "mid", "bot", "support"]),
		);
		expect(roster.filter((p) => p.leader)).toHaveLength(1);
	}
});

test("credible real attributes, levels and seeds (#280)", async () => {
	type P = {
		handle: string;
		team: string;
		role: string;
		level: number;
		placeholder?: true;
		attributes: Record<string, number>;
	};
	const players: P[] = await read("players.json");
	const teams: { id: string; name: string; league: string; seed: number }[] =
		await read("teams.json");
	// The original 2026 calibration benchmark used the full season and its roster.
	if ((await read("lck.json")).season === undefined) {
		const star = (handle: string) => {
			const found = players.find((p) => p.handle === handle && !p.placeholder);
			if (!found) throw new Error(handle);
			return found;
		};
		for (const handle of ["Faker", "Chovy", "Keria", "Ruler"]) {
			const { attributes, level } = star(handle);
			const values = Object.values(attributes);
			expect(Math.min(...values), handle).toBeGreaterThanOrEqual(55);
			expect(Math.max(...values), handle).toBeLessThanOrEqual(95);
			expect(level, handle).toBeGreaterThanOrEqual(70);
			expect(level, handle).toBeLessThanOrEqual(94);
		}
		expect(star("Chovy").level).toBeGreaterThanOrEqual(85);
		expect(
			teams.find(({ name }) => name === "Team Secret Whales")?.seed,
		).toBeGreaterThan(10);
	}
	// Nobody is near the extremes in most attributes.
	for (const { attributes, placeholder } of players) {
		if (placeholder) continue;
		const values = Object.values(attributes);
		expect(values.filter((v) => v < 45 || v > 95).length).toBeLessThan(4);
	}
	const best = (league: string) =>
		Math.min(
			...teams.filter((t) => t.league === league).map((team) => team.seed),
		);
	const topSeed = Math.min(best("LCK"), best("LPL"));
	for (const weaker of ["LCP", "LCS", "CBLOL"])
		expect(best(weaker), weaker).toBeGreaterThan(topSeed);
});
