import type { AiContent, Role } from "@rift-legends/contracts";
import { ROLES } from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	detectIdentities,
	type IdentityChampion,
	type IdentityPick,
} from "./identities";

type Archetype = AiContent["champions"][number]["archetypes"][number];

let next = 0;
function champ(
	traits: {
		archetypes?: Archetype[];
		power?: IdentityChampion["power"];
		kit?: string[];
		ccKinds?: string[];
		positions?: Role[];
		id?: string;
	} = {},
): IdentityChampion {
	return {
		id: traits.id ?? `c${next++}`,
		archetypes: traits.archetypes ?? [],
		power: traits.power ?? "mid",
		kit: traits.kit ?? [],
		ccKinds: traits.ccKinds ?? [],
		positions: traits.positions ?? [...ROLES],
	};
}
const at = (role: Role, champion: IdentityChampion): IdentityPick => ({
	champion,
	role,
});
const plan = (picks: IdentityPick[], id: string) =>
	detectIdentities(picks).plans.find((p) => p.id === id);

/** Five picks that fill dive: two dive and a third with engage. */
const diveTeam = () => [
	at("top", champ({ archetypes: ["dive"] })),
	at("jungle", champ({ archetypes: ["dive"] })),
	at("mid", champ({ archetypes: ["engage"] })),
	at("bot", champ()),
	at("support", champ()),
];

describe("detectIdentities (C8)", () => {
	it("reports no identity for an empty or neutral team", () => {
		expect(detectIdentities([])).toMatchObject({
			primary: null,
			secondary: null,
			complete: false,
		});
		const neutral = ROLES.map((r) => at(r, champ()));
		expect(detectIdentities(neutral)).toMatchObject({
			primary: null,
			secondary: null,
			complete: true,
		});
	});

	describe("thresholds", () => {
		it("activates at the exact threshold and not one below", () => {
			expect(plan(diveTeam(), "dive")).toMatchObject({
				count: 3,
				threshold: 3,
				active: true,
			});
			expect(detectIdentities(diveTeam()).primary).toBe("dive");
			const below = diveTeam().slice(0, 2);
			expect(plan(below, "dive")).toMatchObject({ count: 2, active: false });
			expect(detectIdentities(below).primary).toBeNull();
		});

		it("uses the lower threshold of pick", () => {
			const team = [
				at("jungle", champ({ archetypes: ["pick"] })),
				at("support", champ({ kit: ["hook"] })),
			];
			expect(plan(team, "ambush")).toMatchObject({
				threshold: 2,
				count: 2,
				active: false,
			});
			const withCc = [
				at("jungle", champ({ archetypes: ["pick"] })),
				at("support", champ({ ccKinds: ["targeted"] })),
			];
			expect(plan(withCc, "ambush")).toMatchObject({ active: true });
		});

		it("counts a champion once even with several signals", () => {
			const both = champ({ archetypes: ["dive", "engage", "skirmish"] });
			expect(plan([at("top", both)], "dive")?.count).toBe(1);
		});
	});

	describe("required functions", () => {
		it("does not activate without the required roles in the plan", () => {
			// Three signals but only one dive champion: no two divers.
			const team = [
				at("top", champ({ archetypes: ["dive"] })),
				at("jungle", champ({ archetypes: ["engage"] })),
				at("mid", champ({ archetypes: ["skirmish"] })),
			];
			expect(plan(team, "dive")).toMatchObject({
				count: 3,
				active: false,
				requirements: [{ key: "diveCore", met: false }],
			});
		});

		it("needs three different champions for front-to-back", () => {
			const solo = champ({ archetypes: ["tank", "carry", "peel"] });
			const team = [
				at("top", solo),
				at("jungle", champ({ archetypes: ["tank"] })),
				at("mid", champ({ archetypes: ["tank"] })),
			];
			expect(plan(team, "backline")).toMatchObject({
				count: 3,
				active: false,
			});
			team.push(at("support", champ({ archetypes: ["peel"] })));
			expect(plan(team, "backline")).toMatchObject({ active: true });
		});

		it("takes disengage and enchanter as protectors", () => {
			for (const kit of ["disengage", "enchanter"]) {
				const team = [
					at("top", champ({ archetypes: ["tank"] })),
					at("mid", champ({ archetypes: ["carry"] })),
					at("support", champ({ kit: [kit] })),
				];
				expect(plan(team, "backline")?.active).toBe(true);
			}
		});

		it("engage needs an opener and a different follow-up", () => {
			const wombo = champ({ kit: ["wombo", "aoe"] });
			const three = [
				at("top", wombo),
				at("jungle", champ({ kit: ["aoe"] })),
				at("mid", champ({ archetypes: ["engage"] })),
			];
			expect(plan(three, "collapse")).toMatchObject({ active: true });
			const lone = [at("top", wombo), at("mid", champ({ kit: ["aoe"] }))];
			expect(plan(lone, "collapse")?.active).toBe(false);
			const noFollow = [
				at("top", champ({ archetypes: ["engage"] })),
				at("jungle", champ({ archetypes: ["engage"] })),
				at("mid", champ({ archetypes: ["engage"] })),
			];
			expect(plan(noFollow, "collapse")).toMatchObject({
				count: 3,
				active: false,
			});
		});

		it("poke needs siege capability", () => {
			const pokes = [
				at("mid", champ({ archetypes: ["poke"] })),
				at("bot", champ({ archetypes: ["poke"] })),
				at("support", champ({ archetypes: ["poke"] })),
			];
			expect(plan(pokes, "siege")?.active).toBe(false);
			pokes.push(at("top", champ({ kit: ["siege"] })));
			expect(plan(pokes, "siege")?.active).toBe(true);
		});

		it("early tempo and late scaling", () => {
			const early = [
				at("top", champ({ power: "early" })),
				at("jungle", champ({ power: "early", kit: ["invade"] })),
				at("mid", champ({ archetypes: ["skirmish"] })),
			];
			expect(plan(early, "earlyTempo")).toMatchObject({
				count: 3,
				active: true,
			});
			const late = [
				at("bot", champ({ power: "late", archetypes: ["hypercarry"] })),
				at("mid", champ({ power: "late" })),
				at("support", champ({ archetypes: ["peel"] })),
			];
			expect(plan(late, "lateScaling")).toMatchObject({
				count: 3,
				active: true,
			});
			const noCarry = [
				at("bot", champ({ power: "late" })),
				at("mid", champ({ power: "late" })),
				at("support", champ({ archetypes: ["peel"] })),
			];
			expect(plan(noCarry, "lateScaling")?.active).toBe(false);
		});

		it("split needs side laners and a group", () => {
			const team = [
				at("top", champ({ archetypes: ["splitpush"] })),
				at("mid", champ({ kit: ["duel"] })),
				at("support", champ({ kit: ["disengage"] })),
			];
			expect(plan(team, "sidelanes")?.active).toBe(true);
			// Duelists only: nobody has splitpush.
			const noSplit = [
				at("top", champ({ kit: ["duel"] })),
				at("mid", champ({ kit: ["duel"] })),
				at("support", champ({ kit: ["siege"] })),
			];
			expect(plan(noSplit, "sidelanes")?.active).toBe(false);
			// Right champions in the wrong roles.
			const wrong = [
				at("jungle", champ({ archetypes: ["splitpush"] })),
				at("bot", champ({ kit: ["duel"] })),
				at("support", champ({ kit: ["disengage"] })),
			];
			expect(plan(wrong, "sidelanes")).toMatchObject({
				count: 3,
				active: false,
			});
		});
	});

	describe("ordering and ties", () => {
		it("ranks by how far the threshold is exceeded", () => {
			// dive: 3 contributors (excess 0). backline: 4 (excess 1).
			const team = [
				at("top", champ({ archetypes: ["tank", "dive"] })),
				at("jungle", champ({ archetypes: ["dive", "carry"] })),
				at("mid", champ({ archetypes: ["engage", "peel"] })),
				at("bot", champ({ archetypes: ["hypercarry"] })),
			];
			const result = detectIdentities(team);
			expect(plan(team, "backline")).toMatchObject({ count: 4, active: true });
			expect(plan(team, "dive")).toMatchObject({ count: 3, active: true });
			expect(result.primary).toBe("backline");
			expect(result.secondary).toBe("dive");
		});

		it("breaks ties by contributors and then by id", () => {
			// dive and earlyTempo both active with the same excess and count.
			const team = [
				at("top", champ({ archetypes: ["dive"], power: "early" })),
				at("jungle", champ({ archetypes: ["dive"], power: "early" })),
				at("mid", champ({ archetypes: ["skirmish", "engage"] })),
			];
			const result = detectIdentities(team);
			expect(plan(team, "dive")?.count).toBe(3);
			expect(plan(team, "earlyTempo")?.count).toBe(3);
			// Same excess, same count: ascending id.
			expect(result.primary).toBe("dive");
			expect(result.secondary).toBe("earlyTempo");
		});

		it("prefers more contributors when excess ties", () => {
			// Exercise via two active plans with different thresholds:
			// ambush (threshold 2) with 3 champions has excess 1;
			// dive (threshold 3) with 4 has excess 1 and a bigger count.
			const team = [
				at("top", champ({ archetypes: ["dive", "pick"] })),
				at("jungle", champ({ archetypes: ["dive", "pick"] })),
				at(
					"mid",
					champ({ archetypes: ["engage", "pick"], ccKinds: ["targeted"] }),
				),
				at("bot", champ({ archetypes: ["skirmish"] })),
			];
			const result = detectIdentities(team);
			const dive = plan(team, "dive");
			const ambush = plan(team, "ambush");
			expect(dive).toMatchObject({ count: 4, active: true });
			expect(ambush).toMatchObject({ count: 3, active: true });
			expect(result.primary).toBe("dive");
			expect(result.secondary).toBe("ambush");
		});

		it("only reports a secondary behind a primary", () => {
			const result = detectIdentities(diveTeam());
			expect(result.primary).toBe("dive");
			expect(result.secondary).toBeNull();
		});
	});

	describe("partial drafts and flex", () => {
		it("flags unfinished drafts as provisional", () => {
			const result = detectIdentities(diveTeam().slice(0, 3));
			expect(result).toMatchObject({ primary: "dive", complete: false });
			expect(detectIdentities(diveTeam()).complete).toBe(true);
		});

		it("assigns flex picks stably by ROLES order and id", () => {
			const splitter = champ({
				id: "b",
				archetypes: ["splitpush"],
				positions: ["top", "mid"],
			});
			const duelist = champ({
				id: "a",
				kit: ["duel"],
				positions: ["top", "mid"],
			});
			const group = champ({
				id: "c",
				kit: ["disengage"],
				positions: ["support"],
			});
			const picks = [splitter, duelist, group].map((champion) => ({
				champion,
			}));
			const forward = detectIdentities(picks);
			const reversed = detectIdentities([...picks].reverse());
			expect(forward.assignments).toEqual(reversed.assignments);
			// "a" sorts first: top; "b": mid; "c": support.
			expect(forward.assignments).toEqual({ top: "a", mid: "b", support: "c" });
			expect(forward.plans.find((p) => p.id === "sidelanes")?.active).toBe(
				true,
			);
		});

		it("respects fixed roles before assigning flex picks", () => {
			const flex = champ({ id: "a", positions: ["top", "mid"] });
			const result = detectIdentities([
				{ champion: flex },
				at("top", champ({ id: "z" })),
			]);
			expect(result.assignments).toEqual({ top: "z", mid: "a" });
		});

		it("leaves an unplaceable flex pick unassigned", () => {
			const result = detectIdentities([
				{ champion: champ({ id: "a", positions: ["top"] }) },
				{ champion: champ({ id: "b", positions: ["top"] }) },
			]);
			expect(result.assignments).toEqual({ top: "a" });
		});
	});

	it("explains each plan with its contributors", () => {
		const result = detectIdentities(diveTeam());
		const dive = result.plans.find((p) => p.id === "dive");
		expect(dive?.contributors).toHaveLength(3);
		expect(result.plans.map((p) => p.id)).toEqual(
			[...result.plans.map((p) => p.id)].sort(),
		);
	});

	describe("properties", () => {
		const archetype = fc.constantFrom<Archetype>(
			"tank",
			"engage",
			"peel",
			"poke",
			"dive",
			"pick",
			"carry",
			"hypercarry",
			"splitpush",
			"skirmish",
			"utility",
		);
		const champion = fc.record({
			archetypes: fc.uniqueArray(archetype, { maxLength: 4 }),
			power: fc.constantFrom("early", "mid", "late" as const),
			kit: fc.uniqueArray(
				fc.constantFrom("siege", "wombo", "aoe", "duel", "disengage", "hook"),
				{ maxLength: 3 },
			),
			ccKinds: fc.uniqueArray(fc.constantFrom("targeted", "knockup"), {
				maxLength: 2,
			}),
		});
		const team = fc
			.array(champion, { maxLength: 5 })
			.map((list) =>
				list.map((c, i) => at(ROLES[i] as Role, champ({ ...c, id: `p${i}` }))),
			);

		it("is independent of pick order", () => {
			fc.assert(
				fc.property(team, fc.nat(), (picks, seed) => {
					const rotated = picks.map(
						(_, i) => picks[(i + seed) % picks.length] as IdentityPick,
					);
					expect(detectIdentities(rotated)).toEqual(detectIdentities(picks));
				}),
			);
		});

		it("keeps counts within the team and the pair distinct", () => {
			fc.assert(
				fc.property(team, (picks) => {
					const result = detectIdentities(picks);
					for (const p of result.plans) {
						expect(p.count).toBeLessThanOrEqual(picks.length);
						expect(p.count).toBe(p.contributors.length);
						expect(p.active).toBe(
							p.count >= p.threshold && p.requirements.every((r) => r.met),
						);
					}
					if (result.primary === null) expect(result.secondary).toBeNull();
					if (result.secondary !== null)
						expect(result.secondary).not.toBe(result.primary);
					expect(result.primary === null).toBe(
						!result.plans.some((p) => p.active),
					);
				}),
			);
		});

		it("never loses a plan when a pick without the role-bound plans is added", () => {
			fc.assert(
				fc.property(team, (picks) => {
					if (picks.length === 5) return;
					const before = detectIdentities(picks);
					const after = detectIdentities([
						...picks,
						at(ROLES[picks.length] as Role, champ({ id: "extra" })),
					]);
					for (const p of before.plans)
						if (p.active)
							expect(after.plans.find((q) => q.id === p.id)?.active).toBe(true);
				}),
			);
		});
	});
});
