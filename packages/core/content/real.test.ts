import { aiContent, matchContent, ROLES } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { indexContent } from "../ai/content-index";
import { CONTENT_VERSION } from "../version";
import { loadRealContent } from "./real";

const LEAGUES = ["LCK", "LPL", "LEC", "LCP", "LCS", "CBLOL"];

it("R: parses the real snapshot as draft and match content", () => {
	const { draft, match } = loadRealContent();
	expect(aiContent.parse(draft)).toEqual(draft);
	expect(matchContent.parse(match)).toEqual(match);
});

it("A2: has teams from each of the six leagues", () => {
	const { match } = loadRealContent();
	expect(new Set(match.teams.map(({ league }) => league))).toEqual(
		new Set(LEAGUES),
	);
});

it("fields a player in every role of every team, starters before subs", () => {
	const { draft, match } = loadRealContent();
	const { rosters } = indexContent(draft);
	for (const team of match.teams) {
		const roster = rosters.get(team.id);
		for (const role of ROLES) {
			const player = roster?.get(role);
			expect(player, `${team.id} ${role}`).toBeDefined();
			const starter = draft.players.some(
				(p) => p.team === team.id && p.role === role && !p.sub,
			);
			if (starter) expect(player?.sub ?? false).toBe(false);
		}
	}
});

it("R4: stores no champion names: each name repeats its id", () => {
	for (const champion of loadRealContent().draft.champions) {
		expect(champion.name).toBe(champion.id);
	}
});

it("keeps the shared rules and team plans of the fictional content", async () => {
	const { packagedDraftContent, packagedMatchContent } = await import(
		"./index"
	);
	const { draft, match } = loadRealContent();
	expect(draft.identities).toEqual(packagedDraftContent.identities);
	expect(match.rules).toEqual(packagedMatchContent.rules);
});

it("has its own content version, computed once", () => {
	const real = loadRealContent();
	expect(real.version).toBeGreaterThan(0);
	expect(real.version).not.toBe(CONTENT_VERSION);
	expect(loadRealContent()).toBe(real);
});
