import {
	CONTRACT_VERSION,
	draftQueries,
	parseQuery,
} from "@rift-legends/contracts";
import { expect, it } from "vitest";
import {
	loadRealContent,
	packagedDraftContent,
	packagedMatchContent,
} from "../content";
import { openSession } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";

function card(
	id: string,
	draft = packagedDraftContent,
	match = packagedMatchContent,
) {
	const request = {
		v: CONTRACT_VERSION,
		kind: "draft.champion",
		sessionId: 1,
		params: { champion: id },
	};
	expect(parseQuery(draftQueries, request).ok).toBe(true);
	const result = draftDispatcher.query(
		openSession(1, draftStateWith(draft, match)),
		request,
	);
	if (!result.ok) throw new Error(JSON.stringify(result.error));
	return result.view;
}

it("combines the two profiles and reads one-sided fictional relations from either end", () => {
	expect(card("cragbell")).toMatchObject({
		id: "cragbell",
		damage: "physical",
		power: "mid",
		cc: 8,
		mobility: 5,
		frontline: 9,
		positions: [{ role: "top", tier: "S" }],
		relations: expect.arrayContaining([
			{ kind: "lane", role: "top", other: "rimefoil", value: -5, reasons: [] },
			{ kind: "synergy", other: "duskroot", value: 4, reasons: [] },
		]),
	});
	expect(card("unknown")).toBeNull();
});

it("keeps the real matchup and team counter separate without duplicating mirrored rows", () => {
	const { draft, match } = loadRealContent();
	const result = card("Aatrox", draft, match) as {
		relations: { other: string; kind: string }[];
	};
	const akali = result.relations.filter(
		(r) => r.other === "Akali" && r.kind !== "synergy",
	);
	expect(akali).toHaveLength(2);
	expect(akali).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "lane",
				role: "top",
				value: -2,
				reasons: ["mobilityVsSkillshots"],
			}),
			expect.objectContaining({ kind: "counter", value: -1 }),
		]),
	);
});
