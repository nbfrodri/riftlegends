import type { MapSnapshot } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { teamMap } from "../src/renderer/match/team-map";

const intact = {
	gold: 0,
	kills: 0,
	towers: { top: 0, mid: 0, bot: 0 },
	nexusTowers: 0,
	inhibitors: { top: null, mid: null, bot: null },
	dragons: 0,
	soul: false,
	grubs: 0,
	heralds: 0,
	barons: 0,
	elders: 0,
	buffs: { herald: null, baron: null, elder: null },
} satisfies MapSnapshot["blue"];

const standing = (towers: { standing: boolean }[]) =>
	towers.map((tower) => tower.standing);

test("an intact base has its eleven towers, three inhibitors and nexus standing", () => {
	const view = teamMap(intact, 0);
	expect(view.towers).toEqual({ standing: 11, total: 11 });
	expect(view.lanes.map((lane) => lane.lane)).toEqual(["top", "mid", "bot"]);
	for (const lane of view.lanes) {
		expect(lane.towers.map((tower) => tower.tier)).toEqual([
			"outer",
			"inner",
			"base",
		]);
		expect(standing(lane.towers)).toEqual([true, true, true]);
		expect(lane.inhibitor).toEqual({ standing: true, respawnIn: null });
	}
	expect(view.nexus).toEqual({ standing: true, towers: [true, true] });
	expect(view.objectives).toEqual({
		dragons: 0,
		soul: false,
		grubs: 0,
		heralds: 0,
		barons: 0,
		elders: 0,
	});
	expect(view.effects).toEqual([]);
});

test("towers fall from the outer one inwards and count with the nexus towers", () => {
	const view = teamMap(
		{ ...intact, towers: { top: 3, mid: 0, bot: 1 }, nexusTowers: 1 },
		0,
	);
	const [top, mid, bot] = view.lanes;
	expect(standing(top?.towers ?? [])).toEqual([false, false, false]);
	expect(standing(mid?.towers ?? [])).toEqual([true, true, true]);
	expect(standing(bot?.towers ?? [])).toEqual([false, true, true]);
	expect(view.nexus.towers).toEqual([false, true]);
	expect(view.towers).toEqual({ standing: 6, total: 11 });
});

test("a destroyed inhibitor says how many seconds are left until it is back", () => {
	const view = teamMap(
		{ ...intact, inhibitors: { top: 7, mid: null, bot: null } },
		4 * 60 + 2,
	);
	expect(view.lanes[0]?.inhibitor).toEqual({ standing: false, respawnIn: 178 });
	expect(view.lanes[1]?.inhibitor).toEqual({ standing: true, respawnIn: null });
});

test("a destroyed inhibitor at its respawn second still shows zero, not a negative time", () => {
	const view = teamMap(
		{ ...intact, inhibitors: { top: 3, mid: null, bot: null } },
		200,
	);
	expect(view.lanes[0]?.inhibitor).toEqual({ standing: false, respawnIn: 0 });
});

test("the captured objectives and the soul come from the side's own map", () => {
	const view = teamMap(
		{
			...intact,
			dragons: 4,
			soul: true,
			grubs: 2,
			heralds: 1,
			barons: 2,
			elders: 1,
		},
		0,
	);
	expect(view.objectives).toEqual({
		dragons: 4,
		soul: true,
		grubs: 2,
		heralds: 1,
		barons: 2,
		elders: 1,
	});
});

test("active buffs list their remaining seconds; expired ones are left out", () => {
	const view = teamMap(
		{ ...intact, buffs: { herald: null, baron: 25, elder: 22 } },
		22 * 60 + 30,
	);
	expect(view.effects).toEqual([{ kind: "baron", remaining: 150 }]);
});

test("the nexus can be marked as destroyed", () => {
	expect(teamMap(intact, 0, true).nexus.standing).toBe(false);
});
