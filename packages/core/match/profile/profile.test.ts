import type { AiContent, MatchContent, Role } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../../ai/fixtures/content";
import { fictionalMatchContent } from "../fixtures/content";
import {
	CONTESTS,
	type Lineup,
	PHASES,
	type Profile,
	profiles,
	summarize,
} from "./index";

const forge: Lineup = {
	team: "forge",
	roles: {
		top: "cragbell",
		jungle: "duskroot",
		mid: "glasswake",
		bot: "copperfin",
		support: "bronzehook",
	},
};
const shoal: Lineup = {
	team: "shoal",
	roles: {
		top: "saltspire",
		jungle: "coalstride",
		mid: "waxblade",
		bot: "suncord",
		support: "shellward",
	},
};

interface Setup {
	draft: AiContent;
	match: MatchContent;
	us: Lineup;
	them: Lineup;
}
const base: Setup = {
	draft: fictionalContent,
	match: fictionalMatchContent,
	us: forge,
	them: shoal,
};
const ours = (setup: Setup = base): Profile =>
	profiles(setup.draft, setup.match, setup.us, setup.them).us;

type Attribute = keyof MatchContent["players"][number]["attributes"];
const withAttribute = (
	attribute: Attribute,
	value: number,
	setup = base,
): Setup => ({
	...setup,
	match: {
		...setup.match,
		players: setup.match.players.map((p) =>
			p.id.startsWith("forge-")
				? { ...p, attributes: { ...p.attributes, [attribute]: value } }
				: p,
		),
	},
});
const withRoles = (roles: Partial<Record<Role, string>>): Setup => ({
	...base,
	us: { ...forge, roles: { ...forge.roles, ...roles } },
});
const withDraft = (change: Partial<AiContent>): Setup => ({
	...base,
	draft: { ...base.draft, ...change },
});
const withTeam = (change: Partial<MatchContent["teams"][number]>): Setup => ({
	...base,
	match: {
		...base.match,
		teams: base.match.teams.map((t) =>
			t.id === "forge" ? { ...t, ...change } : t,
		),
	},
});

const contest = (p: Profile, key: (typeof CONTESTS)[number]) =>
	p.contests[key].total;
const phase = (p: Profile, key: (typeof PHASES)[number]) => p.phases[key].total;

describe("profile breakdown", () => {
	it("sums its causes into each total", () => {
		const p = ours();
		for (const scored of [
			...Object.values(p.contests),
			...Object.values(p.phases),
		]) {
			expect(scored.causes.reduce((sum, c) => sum + c.points, 0)).toBe(
				scored.total,
			);
			expect(scored.causes.every((c) => Number.isSafeInteger(c.points))).toBe(
				true,
			);
		}
	});

	it("is the same seen from either team", () => {
		const a = profiles(base.draft, base.match, forge, shoal);
		const b = profiles(base.draft, base.match, shoal, forge);
		expect(b.us).toEqual(a.them);
		expect(b.them).toEqual(a.us);
	});

	it("summarizes into the shape of match.started", () => {
		const summary = summarize(ours());
		expect(Object.keys(summary.phases).sort()).toEqual([...PHASES].sort());
		expect(Object.keys(summary.contests).sort()).toEqual([...CONTESTS].sort());
	});

	it("rejects a lineup without a player in a role", () => {
		expect(() =>
			profiles(base.draft, base.match, { ...forge, team: "ghost" }, shoal),
		).toThrow(/ghost/);
	});
});

describe("F1 · attributes by area", () => {
	it.each([
		["lanes", "lane", "early"],
		["mechanics", "lane", "early"],
		["teamfight", "fight", "late"],
		["macro", "objective", "mid"],
		["farming", "lane", "early"],
		["waves", "siege", "mid"],
		["roaming", "jungle", "early"],
		["anticipation", "jungle", "early"],
		["vision", "objective", "mid"],
		["objectiveControl", "objective", "mid"],
		["positioning", "fight", "late"],
		["communication", "fight", "late"],
	] as const)("%s raises the %s contest and the %s phase", (attr, c, ph) => {
		const low = ours(withAttribute(attr, 40));
		const high = ours(withAttribute(attr, 90));
		expect(contest(high, c)).toBeGreaterThan(contest(low, c));
		expect(phase(high, ph)).toBeGreaterThan(phase(low, ph));
	});

	it("never lowers a contest when an attribute goes up", () => {
		const attributes = [
			"lanes",
			"teamfight",
			"macro",
			"mechanics",
			"farming",
			"waves",
			"roaming",
			"anticipation",
			"vision",
			"objectiveControl",
			"positioning",
			"communication",
			"versatility",
		] as const;
		fc.assert(
			fc.property(
				fc.constantFrom(...attributes),
				fc.integer({ min: 0, max: 99 }),
				(attr, value) => {
					const low = ours(withAttribute(attr, value));
					const high = ours(withAttribute(attr, value + 1));
					for (const key of CONTESTS) {
						expect(contest(high, key)).toBeGreaterThanOrEqual(
							contest(low, key),
						);
					}
				},
			),
			{ numRuns: 60 },
		);
	});
});

describe("F2 · mastery", () => {
	it("a champion the player masters beats one they barely play", () => {
		// forge-top: cragbell is a main, siltwing a weak pick.
		const main = ours(withRoles({ top: "cragbell" }));
		const weak = ours(withRoles({ top: "siltwing" }));
		expect(contest(main, "lane")).toBeGreaterThan(contest(weak, "lane"));
		expect(main.contests.lane.causes).toContainEqual(
			expect.objectContaining({ key: "mastery" }),
		);
	});

	it("versatility softens a champion outside the player's pool", () => {
		// forge-top has never shown fallowhorn.
		const offPool = (value: number) =>
			ours({
				...withAttribute("versatility", value),
				us: withRoles({ top: "fallowhorn" }).us,
			});
		expect(contest(offPool(95), "lane")).toBeGreaterThan(
			contest(offPool(10), "lane"),
		);
		const inPool = (value: number) => ours(withAttribute("versatility", value));
		expect(inPool(95)).toEqual(inPool(10));
	});
});

describe("F3 · draft", () => {
	it("a higher meta tier raises the profile", () => {
		const tiers = (tier: "S+" | "D") =>
			ours(
				withDraft({
					champions: base.draft.champions.map((c) =>
						c.id === "cragbell"
							? { ...c, positions: [{ role: "top", tier }] }
							: c,
					),
				}),
			);
		expect(contest(tiers("S+"), "lane")).toBeGreaterThan(
			contest(tiers("D"), "lane"),
		);
	});

	it("a synergy between allies raises fights", () => {
		const none = ours(withDraft({ synergies: [] }));
		const combo = ours(
			withDraft({
				synergies: [{ a: "bronzehook", b: "copperfin", value: 6 }],
			}),
		);
		expect(contest(combo, "fight")).toBeGreaterThan(contest(none, "fight"));
	});

	it("a lane counter helps one side and hurts the other", () => {
		const even = profiles(base.draft, base.match, forge, shoal);
		const counter = withDraft({
			matchups: [
				{ champion: "cragbell", against: "saltspire", role: "top", value: 8 },
			],
		});
		const countered = profiles(counter.draft, base.match, forge, shoal);
		expect(contest(countered.us, "lane")).toBeGreaterThan(
			contest(even.us, "lane"),
		);
		expect(contest(countered.them, "lane")).toBeLessThan(
			contest(even.them, "lane"),
		);
	});

	it("late champions favour the late game over the early game", () => {
		const power = (value: "early" | "late") =>
			ours(
				withDraft({
					champions: base.draft.champions.map((c) =>
						Object.values(forge.roles).includes(c.id)
							? { ...c, power: value }
							: c,
					),
				}),
			);
		const late = power("late");
		const early = power("early");
		expect(phase(late, "late")).toBeGreaterThan(phase(early, "late"));
		expect(phase(late, "early")).toBeLessThan(phase(early, "early"));
	});
});

describe("F4 · composition in fights", () => {
	const champions = (
		change: (
			c: AiContent["champions"][number],
		) => AiContent["champions"][number],
	) =>
		withDraft({
			champions: base.draft.champions.map((c) =>
				Object.values(forge.roles).includes(c.id) ? change(c) : c,
			),
		});

	it("mixed damage beats a single damage type", () => {
		const physical = ours(champions((c) => ({ ...c, damage: "physical" })));
		expect(contest(ours(), "fight")).toBeGreaterThan(
			contest(physical, "fight"),
		);
	});

	it.each([["frontline"], ["cc"]] as const)(
		"more %s wins more fights",
		(stat) => {
			const tweak = (value: number): Setup => ({
				...base,
				match: {
					...base.match,
					champions: base.match.champions.map((c) =>
						Object.values(forge.roles).includes(c.id)
							? { ...c, [stat]: value }
							: c,
					),
				},
			});
			expect(contest(ours(tweak(9)), "fight")).toBeGreaterThan(
				contest(ours(tweak(1)), "fight"),
			);
		},
	);

	it("peel protects the carries in fights", () => {
		const peel = ours(
			champions((c) =>
				c.id === "bronzehook" ? { ...c, archetypes: ["peel"] } : c,
			),
		);
		const none = ours(
			champions((c) => ({
				...c,
				archetypes: c.archetypes.filter((a) => a !== "peel"),
			})),
		);
		expect(contest(peel, "fight")).toBeGreaterThan(contest(none, "fight"));
	});
});

describe("F5 · chemistry and strategy", () => {
	it("better chemistry raises every contest", () => {
		const pairs = (value: number) =>
			ours(
				withTeam({
					chemistry: [{ a: "forge-mid", b: "forge-jungle", value }],
				}),
			);
		for (const key of CONTESTS) {
			expect(contest(pairs(95), key)).toBeGreaterThan(contest(pairs(20), key));
		}
	});

	it("a fast tempo favours the early game and a slow one the late game", () => {
		const tempo = (value: "slow" | "fast") =>
			ours(
				withTeam({
					strategy: { tempo: value, objectives: "balanced", risk: "balanced" },
				}),
			);
		expect(phase(tempo("fast"), "early")).toBeGreaterThan(
			phase(tempo("slow"), "early"),
		);
		expect(phase(tempo("slow"), "late")).toBeGreaterThan(
			phase(tempo("fast"), "late"),
		);
	});
});
