import { competitionViews } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client } from "./season.fixtures";

// The exhibition season of plan 31 (decision 1): what «Competición» creates on
// entry before a career exists.

type Core = ReturnType<typeof client>;

const exhibition = (core: Core, params: object = {}) => {
	const result = core.query("season.exhibition", params);
	if (!result.ok || !("view" in result))
		throw new Error(JSON.stringify(result));
	return result.view as {
		year: number;
		competitions: { id: string }[];
		teams: { id: string; competition: string; rank: number }[];
	};
};

const overview = (core: Core) => {
	const result = core.query("season.overview", {});
	if (!result.ok || !("view" in result))
		throw new Error(JSON.stringify(result));
	return competitionViews.overview.parse(result.view);
};

test("the real exhibition holds the six leagues and the three international events", () => {
	const core = client();
	const season = exhibition(core);
	expect(season.year).toBe(2026);
	expect(season.competitions.map(({ id }) => id)).toEqual([
		"LCK",
		"LPL",
		"LEC",
		"LCP",
		"LCS",
		"CBLOL",
		"first-stand",
		"msi",
		"worlds",
	]);
	expect(new Set(season.teams.map(({ competition }) => competition))).toEqual(
		new Set(["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"]),
	);
	expect(season.teams.find(({ id }) => id === "T1")).toMatchObject({
		competition: "LCK",
	});
	accepted(core.send("season.create", { ...season, seed: 9 }));
	expect(overview(core).competitions).toHaveLength(9);
}, 60_000);

test("the fictional exhibition is one league of the packaged teams that can be played to its champion", () => {
	const core = client();
	const season = exhibition(core, { content: "fictional" });
	expect(season.competitions).toHaveLength(1);
	expect(season.teams).toHaveLength(8);
	accepted(core.send("season.create", { ...season, seed: 3 }));
	for (let day = overview(core).day; day !== null; day = overview(core).day) {
		accepted(core.send("season.playDay", { day }));
	}
	const [league] = overview(core).competitions;
	expect(league?.status).toBe("finished");
	expect(season.teams.map(({ id }) => id)).toContain(league?.champion);
}, 60_000);
