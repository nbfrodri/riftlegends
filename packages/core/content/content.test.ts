import { aiContent, matchContent, ROLES, TIERS } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { CONTENT_VERSION } from "../version";
import { packagedDraftContent, packagedMatchContent } from "./index";

it("C1: has 70 champions with at least 14 primary picks for every role", () => {
	const { champions } = packagedDraftContent;
	expect(champions).toHaveLength(70);
	for (const role of ROLES) {
		const primary = champions.filter((c) => c.positions[0]?.role === role);
		expect(primary.length).toBeGreaterThanOrEqual(14);
		const tiers = new Set(primary.map((c) => c.positions[0]?.tier));
		expect(tiers).toEqual(new Set(TIERS));
	}
	const flex = champions.filter((c) => c.positions.length > 1);
	expect(flex.length).toBeGreaterThanOrEqual(13);
	expect(flex.length).toBeLessThanOrEqual(17);
});

it("has eight teams with a player and champion pools for every role", () => {
	expect(packagedMatchContent.teams).toHaveLength(8);
	expect(packagedDraftContent.players).toHaveLength(8 * ROLES.length);
	for (const team of packagedMatchContent.teams) {
		const roster = packagedDraftContent.players.filter(
			(p) => p.team === team.id,
		);
		expect(roster.map((p) => p.role).sort()).toEqual([...ROLES].sort());
		for (const player of roster) {
			const profile = packagedMatchContent.players.find(
				(p) => p.id === player.id,
			);
			for (const pool of [player.mains, player.secondary, player.weak]) {
				expect(pool.length).toBeGreaterThan(0);
				expect(profile?.mastery.map((entry) => entry.champion)).toEqual(
					expect.arrayContaining(pool),
				);
			}
		}
	}
});

it("gives every player a unique handle of 2 to 16 letters or digits", () => {
	const handles = packagedDraftContent.players.map((p) => p.handle);
	expect(new Set(handles.map((h) => h.toLowerCase())).size).toBe(
		handles.length,
	);
	for (const handle of handles) expect(handle).toMatch(/^[A-Za-z0-9]{2,16}$/);
	const [first, ...rest] = packagedDraftContent.players;
	const clash = [
		first,
		{ ...rest[0], handle: first?.handle },
		...rest.slice(1),
	];
	expect(
		aiContent.safeParse({ ...packagedDraftContent, players: clash }).success,
	).toBe(false);
});

it("parses as draft and match content", () => {
	expect(aiContent.parse(packagedDraftContent)).toEqual(packagedDraftContent);
	expect(matchContent.parse(packagedMatchContent)).toEqual(
		packagedMatchContent,
	);
});

it("gives every team a visible name and a coach", () => {
	for (const team of packagedMatchContent.teams) {
		expect(team.name.length).toBeGreaterThan(0);
		expect(team.coach.name.length).toBeGreaterThan(0);
	}
});

it("is the content the test fixtures re-export", () => {
	expect(fictionalContent).toBe(packagedDraftContent);
	expect(fictionalMatchContent).toBe(packagedMatchContent);
});

it("C3: gives every champion a display name", () => {
	for (const champion of packagedDraftContent.champions) {
		expect(champion.name).toMatch(/^[A-Z]/);
	}
	const champions = packagedDraftContent.champions.map(
		({ name: _, ...c }) => c,
	);
	expect(
		aiContent.safeParse({ ...packagedDraftContent, champions }).error?.issues,
	).toContainEqual(expect.objectContaining({ path: ["champions", 0, "name"] }));
});

it.each(["champions", "players"] as const)(
	"C3: locates the duplicate draft %s id",
	(block) => {
		const rows = packagedDraftContent[block];
		const result = aiContent.safeParse({
			...packagedDraftContent,
			[block]: [...rows, ...rows.slice(0, 1)],
		});
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({ path: [block, rows.length, "id"] }),
		);
	},
);

it("C3: locates a champion without a role", () => {
	const champions = packagedDraftContent.champions.map((c, i) =>
		i === 0 ? { ...c, positions: [] } : c,
	);
	expect(
		aiContent.safeParse({ ...packagedDraftContent, champions }).error?.issues,
	).toContainEqual(
		expect.objectContaining({ path: ["champions", 0, "positions"] }),
	);
});

it.each(["mains", "secondary", "weak"] as const)(
	"C3: locates an unknown champion in %s",
	(pool) => {
		const players = packagedDraftContent.players.map((p, i) =>
			i === 0 ? { ...p, [pool]: ["unknown-champion"] } : p,
		);
		expect(
			aiContent.safeParse({ ...packagedDraftContent, players }).error?.issues,
		).toContainEqual(
			expect.objectContaining({ path: ["players", 0, pool, 0] }),
		);
	},
);

it.each(["champions", "teams", "players"] as const)(
	"C3–C4: locates the duplicate match %s id",
	(block) => {
		const rows = packagedMatchContent[block];
		const result = matchContent.safeParse({
			...packagedMatchContent,
			[block]: [...rows, ...rows.slice(0, 1)],
		});
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({ path: [block, rows.length, "id"] }),
		);
	},
);

it("C3: locates an unknown champion in mastery", () => {
	const players = packagedMatchContent.players.map((p, i) =>
		i === 0
			? { ...p, mastery: [{ champion: "unknown-champion", value: 80 }] }
			: p,
	);
	expect(
		matchContent.safeParse({ ...packagedMatchContent, players }).error?.issues,
	).toContainEqual(
		expect.objectContaining({ path: ["players", 0, "mastery", 0, "champion"] }),
	);
});

it.each(["name", "seed", "coach"] as const)(
	"C4: requires a team %s",
	(field) => {
		const teams = packagedMatchContent.teams.map((team) =>
			Object.fromEntries(Object.entries(team).filter(([key]) => key !== field)),
		);
		expect(
			matchContent.safeParse({ ...packagedMatchContent, teams }).error?.issues,
		).toContainEqual(expect.objectContaining({ path: ["teams", 0, field] }));
	},
);

it("C4: locates the duplicate team seed", () => {
	const teams = packagedMatchContent.teams.map((team) => ({
		...team,
		seed: 1,
	}));
	expect(
		matchContent.safeParse({ ...packagedMatchContent, teams }).error?.issues,
	).toContainEqual(expect.objectContaining({ path: ["teams", 1, "seed"] }));
});

it.each([
	["matchups", "champion"],
	["matchups", "against"],
	["synergies", "a"],
	["synergies", "b"],
] as const)("C5: locates an unknown champion in %s.%s", (block, field) => {
	const rows = packagedDraftContent[block].map((row, i) =>
		i === 0 ? { ...row, [field]: "unknown-champion" } : row,
	);
	expect(
		aiContent.safeParse({ ...packagedDraftContent, [block]: rows }).error
			?.issues,
	).toContainEqual(expect.objectContaining({ path: [block, 0, field] }));
});

it("C5: rejects a duplicate matchup even if its value differs", () => {
	const { matchups } = packagedDraftContent;
	const duplicated = matchups.slice(0, 1).map((m) => ({ ...m, value: 0 }));
	const result = aiContent.safeParse({
		...packagedDraftContent,
		matchups: [...matchups, ...duplicated],
	});
	expect(result.error?.issues).toContainEqual(
		expect.objectContaining({ path: ["matchups", matchups.length] }),
	);
});

it("C5: rejects synergies repeated in either order", () => {
	const { synergies } = packagedDraftContent;
	const reversed = synergies
		.slice(0, 1)
		.map(({ a, b, value }) => ({ a: b, b: a, value }));
	const result = aiContent.safeParse({
		...packagedDraftContent,
		synergies: [...synergies, ...synergies.slice(0, 1), ...reversed],
	});
	expect(result.error?.issues).toEqual([
		expect.objectContaining({ path: ["synergies", synergies.length] }),
		expect.objectContaining({ path: ["synergies", synergies.length + 1] }),
	]);
});

it("uses a nonzero content version for the packaged dataset", () => {
	expect(CONTENT_VERSION).toBeGreaterThan(0);
});
