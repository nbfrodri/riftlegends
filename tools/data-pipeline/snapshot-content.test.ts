import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { realSnapshotSchema } from "@rift-legends/contracts/real-snapshot";
import { expect, it } from "vitest";
import type { TestRow } from "./snapshot.fixtures.ts";
import {
	cacheDir,
	cargo,
	offline,
	outputDir,
	pointInTime,
	responses,
	scope,
	seedCache,
	tournament,
} from "./snapshot.fixtures.ts";
import { snapshot } from "./snapshot.ts";

it("reports a draft-only source row without creating a scoreboard game", async () => {
	await seedCache({ orphanDraft: true });
	const data = realSnapshotSchema.parse(JSON.parse(await offline()));
	expect(data.games).toHaveLength(3);
	const { oddities } = await snapshot({
		cacheDir,
		outputDir,
		scope,
		offline: true,
	});
	expect(oddities).toMatchObject({ orphanDrafts: 1, missingDraft: 0 });
});

it("resolves an old roster team through the latest same-page rename", async () => {
	await seedCache({ renamedTeam: true });
	const data = realSnapshotSchema.parse(JSON.parse(await offline()));
	expect(
		data.rosters.find(({ team }) => team === "HANJIN BRION")?.coaches,
	).toContainEqual({
		id: "Synthetic Alias Coach",
		name: "Synthetic Alias Coach",
		role: "Coach",
	});
});

it.each([
	["later", "Hanwha Life Esports"],
	["earlier", "HANJIN BRION"],
	["tie", "Hanwha Life Esports"],
] as const)(
	"P4 picks the last team with a %s game date and keeps roster flags",
	async (transfer, team) => {
		await seedCache({ transfer });
		const { seasonPlayers, rosters } = JSON.parse(await offline());
		expect(
			seasonPlayers.filter(({ id }: { id: string }) => id === "Casting"),
		).toMatchObject([{ id: "Casting", team, role: "top", sub: true }]);
		expect(seasonPlayers).toContainEqual({
			id: "SyntheticNoGames",
			name: "SyntheticNoGames",
			role: "top",
			team: "T1",
			sub: true,
			noGames: true,
		});
		expect(
			rosters.find(({ team }: { team: string }) => team === "T1").coaches,
		).toContainEqual({
			id: "SyntheticNoGames",
			name: "SyntheticNoGames",
			role: "Coach",
		});
		expect(
			seasonPlayers.find(({ id }: { id: string }) => id === "GIDEON").sub,
		).toBe(false);
		expect(
			rosters.find(({ team }: { team: string }) => team === "HANJIN BRION")
				.players,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "Casting", sub: true }),
			]),
		);
	},
);

it("lists all unmapped champion names before writing any file", async () => {
	const bodies = await responses({ unknownChampion: true });
	let now = 0;
	await expect(
		snapshot({
			cacheDir,
			outputDir,
			scope,
			fetch: async (input) => {
				const url = new URL(String(input));
				return Response.json(
					bodies.get(
						url.searchParams.get("tables") ??
							url.searchParams.get("action") ??
							url.href,
					),
				);
			},
			now: () => now,
			sleep: async (ms) => {
				now += ms;
			},
		}),
	).rejects.toThrow("Synthetic Unknown 1, Synthetic Unknown 2");
	await expect(readdir(outputDir)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps previous games separate from current teams and rosters", async () => {
	const bodies = await responses();
	const previousPage = tournament.replace("2026", "2025");
	const oldTeam = (team: string | undefined) =>
		team === "T1" ? "Retired Team" : team;
	await snapshot({
		cacheDir,
		outputDir,
		now: () => Date.parse(pointInTime),
		sleep: async () => {},
		scope: scope.map((league) => ({
			...league,
			previousPages: [previousPage],
		})),
		fetch: async (input) => {
			const url = new URL(String(input));
			const table =
				url.searchParams.get("tables") ??
				url.searchParams.get("action") ??
				url.href;
			const body = bodies.get(table);
			if (!url.searchParams.get("where")?.includes(previousPage))
				return Response.json(body);
			expect(["ScoreboardGames", "ScoreboardPlayers"]).toContain(table);
			const { cargoquery } = body as { cargoquery: { title: TestRow }[] };
			return Response.json(
				cargo(
					cargoquery.map(({ title }) => ({
						...title,
						GameId: title.GameId?.replace("2026", "2025"),
						...(table === "ScoreboardGames"
							? {
									OverviewPage: previousPage,
									Team1: oldTeam(title.Team1),
									Team2: oldTeam(title.Team2),
									WinTeam: oldTeam(title.WinTeam),
									"DateTime UTC": title["DateTime UTC"]?.replace(
										"2026",
										"2025",
									),
								}
							: { Team: oldTeam(title.Team) }),
					})),
				),
			);
		},
	});
	const written = realSnapshotSchema.parse(
		JSON.parse(await readFile(join(outputDir, "lck.json"), "utf8")),
	);
	expect(written.previousGames?.map((game) => game.tournament)).toEqual(
		written.games.map(() => previousPage),
	);
	expect(
		written.previousGames?.flatMap((game) => game.lines).length,
	).toBeGreaterThan(0);
	expect(written.teams.map(({ id }) => id)).not.toContain("Retired Team");
	expect(
		written.rosters.every((roster) => roster.tournament === tournament),
	).toBe(true);
});
