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

it("inspects a named content set without committing the session to a series", () => {
	const { draft, match } = loadRealContent();
	const session = openSession(
		1,
		draftStateWith(packagedDraftContent, packagedMatchContent, {
			real: () => ({ content: draft, match }),
		}),
	);
	const request = {
		v: CONTRACT_VERSION,
		kind: "draft.champion",
		sessionId: 1,
		params: { champion: "Aatrox", content: "real" },
	};
	expect(parseQuery(draftQueries, request).ok).toBe(true);
	expect(draftDispatcher.query(session, request)).toMatchObject({
		ok: true,
		view: {
			id: "Aatrox",
			relations: expect.arrayContaining([
				expect.objectContaining({ kind: "counter" }),
			]),
		},
	});
	expect(
		draftDispatcher.query(session, {
			...request,
			params: { champion: "cragbell" },
		}),
	).toMatchObject({ ok: true, view: { id: "cragbell" } });
});

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
	const garen = result.relations.filter(
		(r) => r.other === "Garen" && r.kind !== "synergy",
	);
	expect(garen).toHaveLength(2);
	expect(garen).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "lane",
				role: "top",
				value: -2,
				reasons: ["tankShred"],
			}),
			expect.objectContaining({ kind: "counter", value: -1 }),
		]),
	);
});

it("names the team plans each champion contributes to, from the content identities", () => {
	expect(card("cragbell")).toMatchObject({
		identities: [{ id: "collapse", archetypes: ["engage"] }],
	});
	expect(card("rimefoil")).toMatchObject({
		identities: [{ id: "siege", archetypes: ["poke"] }],
	});
	const tankOnly = {
		...packagedDraftContent,
		identities: [{ id: "wall", archetypes: ["tank" as const], threshold: 1 }],
	};
	expect(card("rimefoil", tankOnly)).toMatchObject({ identities: [] });
});
