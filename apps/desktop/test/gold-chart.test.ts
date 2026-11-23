import { expect, test } from "vitest";
import { goldRange } from "../src/renderer/match/gold-chart";

test.each([
	[[], 2000],
	[[0, 150, -300], 2000],
	[[1999], 2000],
	[[2001], 3000],
	[[1200, -5150], 6000],
	[[12000], 12000],
])("the chart range of %j is %i", (leads, range) => {
	expect(goldRange(leads)).toBe(range);
});
