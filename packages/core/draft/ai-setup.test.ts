import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import type { CommandHandler } from "../server/dispatcher";
import { draftStateWith } from "./index";
import { initialSeries, type SeriesState, seriesCommands } from "./series";

const start = seriesCommands["series.start"] as CommandHandler<SeriesState>;
const POOL = fictionalContent.champions.map((c) => c.id);
const payload = {
	teams: ["t1", "geng"],
	format: "bo1",
	fearless: "off",
	timer: false,
	pool: POOL,
	seed: 4,
	ai: [null, { personality: "meta", coachRating: 40 }],
};

describe("AI teams at the start of a series", () => {
	it("are recorded in series.started", () => {
		const outcome = start(draftStateWith(fictionalContent), payload);
		expect(outcome.ok && outcome.facts[0]).toMatchObject({
			type: "series.started",
			ai: payload.ai,
		});
	});

	it("need the AI content in the session", () => {
		expect(start(initialSeries, payload)).toEqual({
			ok: false,
			error: { code: "invalid-command", params: { path: "ai" } },
		});
	});

	it("are optional: without them series.started has no ai", () => {
		const { ai: _, ...human } = payload;
		const outcome = start(initialSeries, human);
		expect(outcome.ok && "ai" in (outcome.facts[0] ?? {})).toBe(false);
	});
});
