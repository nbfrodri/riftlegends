import { describe, expect, it } from "vitest";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { choose } from "./choose";
import { pickComponents } from "./components/pick";
import type { AiContext } from "./context";
import { scenario } from "./fixtures/scenario";
import { PROFILES } from "./profiles";

const SEEDS = 200;

/** What the AI picks over `SEEDS` seeds on the same board. */
function picks(ctx: AiContext): string[] {
	const taken = new Set([
		...Object.values(ctx.picks).flat(),
		...ctx.bans.filter((b) => b !== null),
	]);
	const score = pickComponents(ctx);
	const candidates = ctx.content.champions
		.filter((c) => !taken.has(c.id))
		.map((c) => ({ champion: c.id, components: score(c.id) }));
	return Array.from({ length: SEEDS }, (_, seed) => {
		const rng = createRng(deriveSeed(seed, SCOPES.ai, 1, ctx.step));
		return choose(rng, candidates, PROFILES.balanced, "normal").champion;
	});
}

const count = (list: readonly string[], ok: (id: string) => boolean) =>
	list.filter(ok).length;

describe("the AI plans around its pick order (issue #364)", () => {
	it("with first pick, it secures a top-tier champion more often", () => {
		const base = scenario({ step: 6 });
		const secured = (id: string) => {
			const positions =
				base.content.champions.find((c) => c.id === id)?.positions ?? [];
			return positions.some((p) => p.tier === "S+" || p.tier === "S");
		};
		const first = count(picks(base), secured);
		// The same board scored as if the team picked last: no first-pick plan.
		const without = count(picks({ ...base, order: "last" }), secured);
		expect(first).toBeGreaterThan(without);
	});

	it("with last pick, it keeps the lane whose opponent is hidden for its final counter", () => {
		// Forge has top and mid open; Shoal has shown its top, not its mid.
		const base = scenario({
			order: "last",
			step: 16,
			picks: {
				forge: ["duskroot", "copperfin", "bronzehook"],
				shoal: ["saltspire", "coalstride", "suncord"],
			},
			bans: ["cragbell", "rimefoil"],
		});
		const midOnly = (id: string) => {
			const positions =
				base.content.champions.find((c) => c.id === id)?.positions ?? [];
			return positions.every((p) => p.role === "mid");
		};
		const last = count(picks(base), midOnly);
		const without = count(picks({ ...base, order: "first" }), midOnly);
		expect(without).toBeGreaterThan(0);
		expect(last).toBeLessThan(without);
	});
});
