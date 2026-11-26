import { expect, it } from "vitest";
import { SCALE } from "../../math";
import { fictionalContent } from "../fixtures/content";
import { comfort } from "./comfort";

// The cached lookup keeps the old order of the pools: mains, secondary, weak (#584).
it("gives what the pools say, mains first, for every player and champion", () => {
	for (const player of fictionalContent.players)
		for (const { id } of fictionalContent.champions) {
			const expected = player.mains.includes(id)
				? 4 * SCALE
				: player.secondary.includes(id)
					? 2 * SCALE
					: player.weak.includes(id)
						? -4 * SCALE
						: 0;
			expect(comfort(player, id)).toBe(expected);
		}
	expect(comfort(undefined, "any")).toBe(0);
});
