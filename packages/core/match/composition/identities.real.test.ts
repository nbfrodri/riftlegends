import { ROLES, type Role } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { packagedDraftContent } from "../../content";
import { loadRealContent } from "../../content/real";
import {
	detectIdentities,
	type IdentityChampion,
	type IdentityPick,
} from "./identities";

const IDENTITIES = [
	"ambush",
	"backline",
	"collapse",
	"dive",
	"earlyTempo",
	"lateScaling",
	"sidelanes",
	"siege",
] as const;

type Content = ReturnType<typeof loadRealContent>["draft"]["champions"][number];
const asChampion = (champion: Content): IdentityChampion => ({
	...champion,
	positions: champion.positions.map(({ role }) => role),
});

/** How far the team is from the plan: active first, then requirements met. */
function score(picks: readonly IdentityPick[], id: string) {
	const plan = detectIdentities(picks).plans.find((p) => p.id === id);
	if (!plan) return 0;
	return (
		(plan.active ? 1000 : 0) +
		plan.requirements.filter((r) => r.met).length * 100 +
		plan.count
	);
}

/** Coordinate ascent over legal picks (one champion per role), no randomness. */
function draftFor(champions: readonly IdentityChampion[], id: string) {
	const pickable = (role: Role) =>
		champions.filter((c) => c.positions?.includes(role));
	const picks = new Map<Role, IdentityPick>();
	const team = () => [...picks.values()];
	for (const role of ROLES) {
		const taken = new Set(team().map((p) => p.champion.id));
		const best = pickable(role)
			.filter((c) => !taken.has(c.id))
			.map((champion) => ({
				pick: { champion, role },
				value: score([...team(), { champion, role }], id),
			}))
			.sort((a, b) => b.value - a.value)[0];
		if (best) picks.set(role, best.pick);
	}
	for (let improved = true; improved; ) {
		improved = false;
		for (const role of ROLES) {
			const others = team().filter((p) => p.role !== role);
			const taken = new Set(others.map((p) => p.champion.id));
			let value = score(team(), id);
			for (const champion of pickable(role)) {
				if (taken.has(champion.id)) continue;
				const next = score([...others, { champion, role }], id);
				if (next > value) {
					value = next;
					picks.set(role, { champion, role });
					improved = true;
				}
			}
		}
	}
	return team();
}

describe("kit traits in the packaged content (#448)", () => {
	it("publishes known kit traits, CC kinds and damage split on every real champion", () => {
		for (const champion of loadRealContent().draft.champions) {
			expect(champion.kit, champion.id).toBeDefined();
			expect(champion.ccKinds, champion.id).toBeDefined();
			expect(champion.split, champion.id).toBeDefined();
			expect(champion.traitSources, champion.id).toBeDefined();
		}
	});

	it("publishes them on every fictional champion too", () => {
		for (const champion of packagedDraftContent.champions) {
			expect(champion.kit, champion.id).toBeDefined();
			expect(champion.ccKinds, champion.id).toBeDefined();
			expect(champion.split, champion.id).toBeDefined();
		}
	});

	it.each(IDENTITIES)(
		"activates %s in at least one draft of the real content",
		(id) => {
			const champions = loadRealContent().draft.champions.map(asChampion);
			const picks = draftFor(champions, id);
			const plan = detectIdentities(picks).plans.find((p) => p.id === id);
			expect(picks).toHaveLength(ROLES.length);
			expect(plan, id).toMatchObject({ active: true });
		},
	);
});
