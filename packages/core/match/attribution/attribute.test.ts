import { ROLES, type Role } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { matchSetup } from "../fixtures/setup";
import { createMatch } from "../state";
import { attribute, type Engagement } from "./attribute";

const state = createMatch(matchSetup());
const at = (kill: number, contest = 30, event = 0) => ({
	contest,
	event,
	kill,
});
const engagements: readonly Engagement[] = [
	{ kind: "duel", lane: "top" },
	{ kind: "duel", lane: "mid" },
	{ kind: "duo" },
	{ kind: "gank", lane: "top" },
	{ kind: "gank", lane: "mid" },
	{ kind: "gank", lane: "bot" },
	{ kind: "skirmish" },
	{ kind: "teamfight" },
];
const LOCAL: Record<string, readonly Role[]> = {
	top: ["jungle", "top"],
	mid: ["jungle", "mid"],
	bot: ["jungle", "bot", "support"],
};

describe("R1: who scores and who assists", () => {
	it("is the same for the same seed, game, minute, contest, event and kill", () => {
		const a = attribute(state, "blue", { kind: "teamfight" }, at(2));
		expect(attribute(state, "blue", { kind: "teamfight" }, at(2))).toEqual(a);
	});

	it("gives a duel to its laner with no assists", () => {
		for (const lane of ["top", "mid"] as const) {
			expect(attribute(state, "red", { kind: "duel", lane }, at(0, 1))).toEqual(
				{
					killer: lane,
					assists: [],
				},
			);
		}
	});

	it("keeps every author and assistant inside the roles of the engagement", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 2 ** 31 }),
				fc.constantFrom(...engagements),
				fc.integer({ min: 1, max: 60 }),
				fc.integer({ min: 0, max: 5 }),
				fc.constantFrom("blue", "red"),
				(seed, engagement, minute, kill, side) => {
					const s = { ...createMatch(matchSetup({ seed })), minute };
					const { killer, assists } = attribute(s, side, engagement, at(kill));
					expect(new Set(assists).size).toBe(assists.length);
					expect(assists).not.toContain(killer);
					const all = [killer, ...assists];
					if (engagement.kind === "gank") {
						for (const role of all)
							expect(LOCAL[engagement.lane]).toContain(role);
						expect(assists.length).toBeGreaterThanOrEqual(1);
						expect(assists.length).toBeLessThanOrEqual(2);
					}
					if (engagement.kind === "duo") {
						for (const role of all) expect(["bot", "support"]).toContain(role);
						expect(assists.length).toBeLessThanOrEqual(1);
					}
					if (engagement.kind === "skirmish") {
						expect(assists.length).toBeGreaterThanOrEqual(1);
						expect(assists.length).toBeLessThanOrEqual(2);
					}
					if (engagement.kind === "teamfight") {
						expect(assists.length).toBeGreaterThanOrEqual(2);
						expect(assists.length).toBeLessThanOrEqual(4);
					}
				},
			),
		);
	});

	it("gives a duo kill to either the carry or the support, and mostly to the carry", () => {
		const authors = { bot: 0, support: 0 };
		for (let seed = 0; seed < 400; seed++) {
			const s = createMatch(matchSetup({ seed }));
			const { killer } = attribute(s, "blue", { kind: "duo" }, at(0, 3));
			authors[killer as "bot" | "support"]++;
		}
		expect(authors.bot + authors.support).toBe(400);
		expect(authors.bot).toBeGreaterThan(authors.support);
		expect(authors.support).toBeGreaterThan(0);
	});

	it("makes the support the rarest author and the most frequent assistant in team fights", () => {
		const kills = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<
			Role,
			number
		>;
		const assists = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<
			Role,
			number
		>;
		for (let seed = 0; seed < 600; seed++) {
			const s = createMatch(matchSetup({ seed }));
			for (let k = 0; k < 4; k++) {
				const r = attribute(s, "blue", { kind: "teamfight" }, at(k));
				kills[r.killer]++;
				for (const a of r.assists) assists[a]++;
			}
		}
		for (const role of ROLES.filter((r) => r !== "support")) {
			expect(kills.support).toBeLessThan(kills[role]);
			expect(assists.support).toBeGreaterThan(assists[role]);
		}
		expect(kills.bot).toBeGreaterThan(kills.top);
	});

	it("reads the weights of each side's own players", () => {
		const setup = matchSetup();
		const dull = createMatch({
			...setup,
			match: {
				...setup.match,
				players: setup.match.players.map((p) => ({
					...p,
					attributes: { ...p.attributes, mechanics: 0, positioning: 0 },
				})),
			},
		});
		for (const role of ROLES) {
			expect(dull.context.blue.attribution[role].kill).toBeLessThan(
				state.context.blue.attribution[role].kill,
			);
		}
	});
});
