import {
	CONTRACT_VERSION,
	type ContentDatabase,
	contentDatabase,
} from "@rift-legends/contracts";
import {
	draftDispatcher,
	draftStateWith,
	loadRealContent,
	openSession,
	packagedDraftContent,
	packagedMatchContent,
} from "@rift-legends/core";
import { describe, expect, test } from "vitest";
import {
	activeDatabaseFilters,
	type DatabaseFilters,
	type DatabasePlayer,
	databasePlayers,
	EMPTY_DATABASE_FILTERS,
	filterDatabasePlayers,
	isDatabasePresetOn,
	toggleDatabasePreset,
} from "../src/renderer/database/database-filters";

function realDatabase(): ContentDatabase {
	const { draft, match } = loadRealContent();
	const session = openSession(
		1,
		draftStateWith(packagedDraftContent, packagedMatchContent, {
			real: () => ({ content: draft, match }),
		}),
	);
	const result = draftDispatcher.query(session, {
		v: CONTRACT_VERSION,
		kind: "content.database",
		sessionId: 1,
		params: { content: "real" },
	});
	if (!result.ok) throw new Error(JSON.stringify(result));
	return contentDatabase.parse(result.view);
}

const database = realDatabase();
const all = databasePlayers(database);
const where = (filters: Partial<DatabaseFilters>) =>
	filterDatabasePlayers(all, { ...EMPTY_DATABASE_FILTERS, ...filters });
const count = (keep: (p: DatabasePlayer) => boolean) => all.filter(keep).length;

describe("databasePlayers", () => {
	test("gives every player the name and league of their team", () => {
		expect(all).toHaveLength(database.players.length);
		const faker = all.find((p) => p.handle === "Faker");
		expect(faker).toMatchObject({ teamName: "T1", league: "LCK" });
	});
});

describe("filterDatabasePlayers", () => {
	test("keeps every player with no filter", () => {
		expect(where({})).toEqual(all);
		expect(activeDatabaseFilters(EMPTY_DATABASE_FILTERS)).toEqual([]);
	});

	test("keeps the chosen roles, rating range, league, team and nationality", () => {
		expect(where({ roles: ["mid"] })).toHaveLength(
			count((p) => p.role === "mid"),
		);
		expect(where({ rating: { min: 80 } })).toHaveLength(
			count((p) => p.level >= 80),
		);
		expect(where({ league: "LEC" })).toHaveLength(
			count((p) => p.league === "LEC"),
		);
		expect(where({ team: "T1" })).toHaveLength(count((p) => p.team === "T1"));
		expect(where({ nationality: "KR" })).toHaveLength(
			count((p) => p.nationality === "KR"),
		);
		expect(where({ status: "sub" })).toHaveLength(count((p) => p.sub));
	});

	test("combines filters: a player passes every one in use", () => {
		const result = where({ roles: ["mid"], league: "LCK", status: "starter" });
		expect(result.length).toBeGreaterThan(0);
		for (const p of result)
			expect([p.role, p.league, p.sub]).toEqual(["mid", "LCK", false]);
		expect(
			activeDatabaseFilters({
				...EMPTY_DATABASE_FILTERS,
				roles: ["mid"],
				league: "LCK",
				status: "starter",
			}),
		).toEqual(["roles", "league", "status"]);
	});

	test("presets set a filter and a second click removes it", () => {
		let filters = toggleDatabasePreset(EMPTY_DATABASE_FILTERS, "top");
		expect(filters.rating).toEqual({ min: 80 });
		expect(isDatabasePresetOn(filters, "top")).toBe(true);
		filters = toggleDatabasePreset(filters, "starters");
		expect(filters.status).toBe("starter");
		filters = toggleDatabasePreset(filters, "top");
		expect(filters).toEqual({ ...EMPTY_DATABASE_FILTERS, status: "starter" });
	});

	// Spike S2: a frame is 16.7 ms; filtering and sorting every player fits.
	test("filters and sorts the whole list within a frame", () => {
		const run = () =>
			[...where({ roles: ["mid", "top"], rating: { min: 60 } })].sort(
				(a, b) => b.level - a.level,
			);
		run();
		const times = Array.from({ length: 21 }, () => {
			const start = performance.now();
			run();
			return performance.now() - start;
		}).sort((a, b) => a - b);
		expect(times[10]).toBeLessThan(16.7);
	});
});
