import type { AiSettings, SideChoice } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import { decideSide } from "./side-choice";

const ALL: SideChoice[] = ["blue", "red", "first", "last"];

/** How often each choice wins over 200 seeds. */
const tally = (settings: AiSettings, options: readonly SideChoice[]) => {
	const counts: Partial<Record<SideChoice, number>> = {};
	for (let seed = 0; seed < 200; seed++) {
		const rng = createRng(deriveSeed(seed, SCOPES.side, 1, 0));
		const { choice } = decideSide(rng, options, settings);
		counts[choice] = (counts[choice] ?? 0) + 1;
	}
	return counts;
};

const favourite = (counts: Partial<Record<SideChoice, number>>) =>
	Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

describe("AI side choice (issue #305)", () => {
	it("a counterpick coach with priority takes the last pick", () => {
		const counts = tally(
			{ personality: "counterpick", difficulty: "hard" },
			ALL,
		);
		expect(favourite(counts)).toBe("last");
	});

	it("a flex or meta coach with priority takes the first pick", () => {
		expect(
			favourite(tally({ personality: "flex", difficulty: "hard" }, ALL)),
		).toBe("first");
		expect(
			favourite(tally({ personality: "meta", difficulty: "hard" }, ALL)),
		).toBe("first");
	});

	it("only takes one of the options it is given", () => {
		const counts = tally({ personality: "counterpick" }, ["blue", "red"]);
		expect(Object.keys(counts).every((c) => c === "blue" || c === "red")).toBe(
			true,
		);
		expect(favourite(counts)).toBe("blue");
	});

	it("explains its choice with the components of the chosen option", () => {
		const rng = createRng(deriveSeed(3, SCOPES.side, 1, 0));
		const decision = decideSide(rng, ALL, { personality: "counterpick" });
		expect(decision.components.length).toBeGreaterThan(0);
		expect(decision.components.reduce((sum, c) => sum + c.points, 0)).toBe(
			decision.total,
		);
		expect(decision.alternatives.map((a) => a.choice)).not.toContain(
			decision.choice,
		);
	});

	it("is the same for the same seed", () => {
		const decide = () =>
			decideSide(createRng(deriveSeed(9, SCOPES.side, 2, 0)), ALL, {
				personality: "balanced",
			});
		expect(decide()).toEqual(decide());
	});
});
