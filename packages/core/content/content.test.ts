import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { CONTENT_VERSION } from "../version";
import { packagedDraftContent, packagedMatchContent } from "./index";

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
