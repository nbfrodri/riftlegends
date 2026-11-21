import { aiContent, matchContent } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { packagedDraftContent, packagedMatchContent } from "./index";

it("parses as draft and match content", () => {
	expect(aiContent.parse(packagedDraftContent)).toEqual(packagedDraftContent);
	expect(matchContent.parse(packagedMatchContent)).toEqual(
		packagedMatchContent,
	);
});

it("gives every team a visible name and a coach", () => {
	for (const team of packagedMatchContent.teams) {
		expect(team.name?.length).toBeGreaterThan(0);
		expect(team.coach?.name.length).toBeGreaterThan(0);
	}
});

it("is the content the test fixtures re-export", () => {
	expect(fictionalContent).toBe(packagedDraftContent);
	expect(fictionalMatchContent).toBe(packagedMatchContent);
});
