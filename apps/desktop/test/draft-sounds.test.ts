import type { DraftView } from "@rift-legends/contracts";
import { describe, expect, test } from "vitest";
import { draftSounds } from "../src/renderer/sound/draft-sounds";

function view(
	blue: { bans?: (string | null)[]; picks?: string[] } = {},
	red: { bans?: (string | null)[]; picks?: string[] } = {},
	game = 1,
): DraftView {
	return {
		game,
		wins: [0, 0],
		phase: "picks1",
		turn: null,
		choices: [],
		first: "blue",
		blue: { team: "forge", bans: blue.bans ?? [], picks: blue.picks ?? [] },
		red: { team: "shoal", bans: red.bans ?? [], picks: red.picks ?? [] },
		availability: [],
	} as DraftView;
}

describe("draft sounds (#472)", () => {
	test("the first view of a draft plays nothing", () => {
		expect(draftSounds(null, view({ picks: ["ahri"] }), "forge")).toEqual([]);
	});

	test("any new ban plays the ban sound, mine or the rival's", () => {
		expect(draftSounds(view(), view({ bans: ["ahri"] }), "forge")).toEqual([
			"ban",
		]);
		expect(draftSounds(view(), view({}, { bans: ["ahri"] }), "forge")).toEqual([
			"ban",
		]);
	});

	test("a skipped ban plays nothing", () => {
		expect(draftSounds(view(), view({ bans: [null] }), "forge")).toEqual([]);
	});

	test("confirming my pick locks it in; a rival pick plays the pick sound", () => {
		expect(draftSounds(view(), view({ picks: ["ahri"] }), "forge")).toEqual([
			"lock",
		]);
		expect(draftSounds(view(), view({}, { picks: ["ahri"] }), "forge")).toEqual(
			["pick"],
		);
	});

	test("without a human team every pick is a pick", () => {
		expect(draftSounds(view(), view({ picks: ["ahri"] }), null)).toEqual([
			"pick",
		]);
	});

	test("one update with a rival ban and pick plays each sound once", () => {
		expect(
			draftSounds(
				view(),
				view({}, { bans: ["ahri", "zed"], picks: ["lux"] }),
				"forge",
			),
		).toEqual(["ban", "pick"]);
	});

	test("a new game resets the board without a sound", () => {
		expect(
			draftSounds(
				view({ picks: ["ahri"] }),
				view({ bans: ["zed"] }, {}, 2),
				"forge",
			),
		).toEqual([]);
	});
});
