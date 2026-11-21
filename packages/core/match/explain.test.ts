import { describe, expect, it } from "vitest";
import { decisive } from "./explain";
import type { EventFact } from "./stats";

const event = (change: Partial<EventFact>): EventFact => ({
	position: 1,
	game: 1,
	minute: 5,
	second: 0,
	kind: "fight",
	side: "blue",
	zone: "lane-mid",
	kills: [],
	gold: { blue: 0, red: 0 },
	chance: 5000,
	causes: [],
	...change,
});

describe("M6 · why it was won", () => {
	it("cites the winner's contests that weighed the most", () => {
		const events = [
			event({ position: 1, kind: "lane", chance: 2000 }),
			event({ position: 2, kind: "fight", chance: 3000 }),
			event({ position: 3, kind: "baron", chance: 4000 }),
			event({ position: 4, kind: "fight", chance: 9000 }),
			event({ position: 5, kind: "fight", chance: 1000, side: "red" }),
		];
		const result = decisive(events, "blue");
		expect(result.map((d) => d.event)).toEqual([2, 3, 1]);
		expect(result.map((d) => d.swing)).toEqual([7000, 6000, 1600]);
	});

	it("keeps at most three, ordered by swing and then by position", () => {
		const events = Array.from({ length: 6 }, (_, i) =>
			event({ position: 10 - i, chance: 5000 }),
		);
		expect(decisive(events, "blue").map((d) => d.event)).toEqual([5, 6, 7]);
	});

	it("never cites the other side or the nexus", () => {
		const events = [
			event({ position: 1, side: "red", chance: 100 }),
			event({ position: 2, kind: "nexus", chance: 100 }),
		];
		expect(decisive(events, "blue")).toEqual([]);
	});

	it("weighs a fight above a lane at the same odds", () => {
		const events = [
			event({ position: 1, kind: "lane", chance: 3000 }),
			event({ position: 2, kind: "fight", chance: 3000 }),
		];
		expect(decisive(events, "blue").map((d) => d.event)).toEqual([2, 1]);
	});
});
