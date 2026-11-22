import { expect, it } from "vitest";
import { indexContent } from "./content-index";
import { fictionalContent } from "./fixtures/content";

const [first] = fictionalContent.players;
if (!first) throw new Error("fixture without players");

const withRoster = (players: typeof fictionalContent.players) => ({
	...fictionalContent,
	players,
});

it.each([
	["before", true],
	["after", false],
])("fields the starter of a role when a sub is listed %s it", (_, subFirst) => {
	const sub = { ...first, id: "sub", handle: "Bench Warmer", sub: true };
	const starter = { ...first, sub: false };
	const roster = indexContent(
		withRoster(subFirst ? [sub, starter] : [starter, sub]),
	).rosters.get(first.team);
	expect(roster?.get(first.role)?.id).toBe(first.id);
});

it("fields the first listed player of a role that only has subs", () => {
	const a = { ...first, id: "a", handle: "SubA", sub: true };
	const b = { ...first, id: "b", handle: "SubB", sub: true };
	const roster = indexContent(withRoster([a, b])).rosters.get(first.team);
	expect(roster?.get(first.role)?.id).toBe("a");
});
