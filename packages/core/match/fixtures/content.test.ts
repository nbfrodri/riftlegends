import { matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalContent as draft } from "../../ai/fixtures/content";
import { fictionalMatchContent as content } from "./content";

const ids = <T extends { id: string }>(list: readonly T[]) =>
	list.map((item) => item.id).sort();

it("parses as match content", () => {
	expect(matchContent.parse(content)).toEqual(content);
});

it("covers every player, team and champion of the draft fixture", () => {
	expect(ids(content.players)).toEqual(ids(draft.players));
	expect(ids(content.champions)).toEqual(ids(draft.champions));
	expect(ids(content.teams)).toEqual(
		[...new Set(draft.players.map((p) => p.team))].sort(),
	);
});

it("gives each team one leader and chemistry between its own players", () => {
	const teamOf = new Map(draft.players.map((p) => [p.id, p.team]));
	for (const team of content.teams) {
		const leaders = content.players.filter(
			(p) => p.leader && teamOf.get(p.id) === team.id,
		);
		expect(leaders).toHaveLength(1);
		expect(team.chemistry.length).toBeGreaterThan(0);
		for (const { a, b } of team.chemistry) {
			expect([teamOf.get(a), teamOf.get(b)]).toEqual([team.id, team.id]);
		}
	}
});

it("gives mastery only on champions the player can play", () => {
	const pools = new Map(
		draft.players.map((p) => [p.id, [...p.mains, ...p.secondary, ...p.weak]]),
	);
	for (const player of content.players) {
		expect(player.mastery.length).toBeGreaterThan(0);
		for (const { champion } of player.mastery) {
			expect(pools.get(player.id)).toContain(champion);
		}
	}
});

it("varies the attributes and the team styles", () => {
	const values = content.players.flatMap((p) => Object.values(p.attributes));
	const sorted = [...values].sort((x, y) => x - y);
	expect((sorted.at(-1) ?? 0) - (sorted[0] ?? 0)).toBeGreaterThanOrEqual(30);
	const [a, b] = content.teams;
	expect(a?.strategy).not.toEqual(b?.strategy);
});

it("spawns objectives in plausible order and sets the gold saturation", () => {
	const { objectives, fullBuildGold, goldOverflow } = content.rules;
	expect(objectives.dragon.first).toBeLessThan(objectives.baron.first);
	expect(objectives.herald.first).toBeLessThan(objectives.baron.first);
	// Void grubs: up at 8:00 and gone at 14:45, before the Herald at 15:00.
	expect(objectives.grub).toEqual({ first: 480, despawn: 885 });
	expect(objectives.grub.despawn).toBeLessThanOrEqual(objectives.herald.first);
	expect(fullBuildGold).toBeGreaterThan(0);
	expect(goldOverflow).toBeLessThan(10000);
});
