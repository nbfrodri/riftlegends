import { PERSONALITIES, type Personality } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { SCALE } from "../math";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { choose, type Scored } from "./choose";
import { PROFILES, type Profile } from "./profiles";

function candidate(champion: string, scores: Record<string, number>): Scored {
	return {
		champion,
		components: Object.entries(scores).map(([key, units]) => ({
			key,
			points: units * SCALE,
		})),
	};
}

// Each pair puts the balanced favourite first and the specialist's choice second.
const scenarios: Record<Exclude<Personality, "balanced">, [Scored, Scored]> = {
	meta: [
		candidate("main", { meta: 3, comfort: 4 }),
		candidate("patch-leader", { meta: 6 }),
	],
	comfort: [
		candidate("patch-leader", { meta: 6 }),
		candidate("main", { meta: 1, comfort: 4 }),
	],
	counterpick: [
		candidate("blind-pick", { meta: 6 }),
		candidate("lane-counter", { meta: 1, matchup: 4 }),
	],
	pocket: [
		candidate("patch-leader", { meta: 6 }),
		candidate("off-meta-main", { meta: 1, comfort: 4 }),
	],
	architect: [
		candidate("strong-solo", { meta: 6 }),
		candidate("combo-partner", { meta: 1, synergy: 4 }),
	],
	early: [
		candidate("blind-pick", { meta: 6 }),
		candidate("skirmisher", { meta: 1, matchup: 2, synergy: 2 }),
	],
	scaling: [
		candidate("patch-leader", { meta: 6 }),
		candidate("peel-for-carry", { meta: 1, composition: 4 }),
	],
	flex: [
		candidate("single-role", { meta: 6 }),
		candidate("two-role-flex", { meta: 3, flex: 2 }),
	],
	"star-ban": [
		candidate("meta-ban", { meta: 6 }),
		candidate("star-main", { meta: 1, targetBan: 4 }),
	],
	"pool-drain": [
		candidate("meta-ban", { meta: 5 }),
		candidate("last-comfort-ban", { meta: 2, targetBan: 2 }),
	],
	"side-lane": [
		candidate("teamfight-pick", { meta: 6 }),
		candidate("splitpush-enabler", { meta: 3, identity: 2 }),
	],
};

function specialistPickCount(candidates: [Scored, Scored], profile: Profile) {
	let picks = 0;
	for (let seed = 0; seed < 64; seed++) {
		const rng = createRng(deriveSeed(seed, SCOPES.ai, 0));
		if (
			choose(rng, candidates, profile, "hard").champion ===
			candidates[1].champion
		)
			picks++;
	}
	return picks;
}

describe("draft preferences (D1)", () => {
	it.each(PERSONALITIES.filter((p) => p !== "balanced"))(
		"%s favours its specialist over the balanced favourite",
		(personality) => {
			const candidates = scenarios[personality];
			expect(specialistPickCount(candidates, PROFILES.balanced)).toBeLessThan(
				32,
			);
			expect(
				specialistPickCount(candidates, PROFILES[personality]),
			).toBeGreaterThan(32);
		},
	);
});

describe("balanced (D2)", () => {
	it("leaves all component scores and difficulty settings unchanged", () => {
		const profile = PROFILES.balanced;
		expect(profile).toMatchObject({
			temperature: SCALE,
			pool: 0,
			wildcard: SCALE,
		});
		expect(
			Object.values(profile.weights).every((weight) => weight === SCALE),
		).toBe(true);
	});
});
