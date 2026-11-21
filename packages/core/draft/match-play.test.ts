import { ROLES } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import type { CommandHandler, Outcome } from "../server/dispatcher";
import { DRAFT_ORDER } from "./order";
import { initialSeries, type SeriesState, seriesCommands } from "./series";

type Accepted = Extract<Outcome<SeriesState>, { ok: true }>;
const run = (state: SeriesState, kind: string, payload: object) =>
	(
		seriesCommands[
			kind as keyof typeof seriesCommands
		] as CommandHandler<SeriesState>
	)(state, payload);
const ok = (outcome: Outcome<SeriesState>): Accepted => {
	if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
	return outcome;
};

const POOL = fictionalContent.champions.map((c) => c.id);
/** The champions each team's players main, in role order. */
const mains = (team: string) =>
	ROLES.map(
		(role) =>
			fictionalContent.players.find((p) => p.team === team && p.role === role)
				?.mains[0] ?? "",
	);

const loaded = (match = fictionalMatchContent): SeriesState => ({
	...initialSeries,
	content: fictionalContent,
	match,
});

function drafted(state = loaded()) {
	let current = ok(
		run(state, "series.start", {
			teams: ["forge", "shoal"],
			seeds: [1, 2],
			format: "bo3",
			fearless: "off",
			timer: false,
			pool: POOL,
			seed: 11,
		}),
	).state;
	current = ok(
		run(current, "side.choose", { team: "forge", side: "blue" }),
	).state;
	const wanted = { blue: mains("forge"), red: mains("shoal") };
	const next = { blue: 0, red: 0 };
	for (const step of DRAFT_ORDER) {
		const team = current.draft?.[step.side] ?? "";
		if (step.action === "ban") {
			current = ok(run(current, "draft.ban", { team, champion: null })).state;
			continue;
		}
		const champion = wanted[step.side][next[step.side]++];
		current = ok(run(current, "draft.pick", { team, champion })).state;
	}
	for (const [side, team] of [
		["blue", "forge"],
		["red", "shoal"],
	] as const) {
		const [top, jungle, mid, bot, support] = wanted[side];
		current = ok(
			run(current, "draft.roles", {
				team,
				roles: { top, jungle, mid, bot, support },
			}),
		).state;
	}
	return current;
}

describe("match.play", () => {
	it("plays the game and finishes it with its winner", () => {
		const outcome = ok(run(drafted(), "match.play", {}));
		const types = outcome.facts.map((f) => f.type);
		expect(types[0]).toBe("match.started");
		expect(types.at(-2)).toBe("match.ended");
		expect(types.at(-1)).toBe("game.finished");
		const ended = outcome.facts.at(-2) as unknown as { winner: string };
		expect(outcome.facts.at(-1)).toMatchObject({
			game: 1,
			winner: ended.winner,
		});
		const index = ended.winner === "forge" ? 0 : 1;
		expect(outcome.state.wins[index]).toBe(1);
		expect(outcome.state.phase).toBe("side");
	});

	it("is deterministic for the series seed", () => {
		expect(run(drafted(), "match.play", {})).toEqual(
			run(drafted(), "match.play", {}),
		);
	});

	it("only plays once both drafts are done", () => {
		const started = ok(
			run(loaded(), "series.start", {
				teams: ["forge", "shoal"],
				seeds: [1, 2],
				format: "bo1",
				fearless: "off",
				timer: false,
				pool: POOL,
				seed: 1,
			}),
		).state;
		expect(run(started, "match.play", {})).toMatchObject({
			ok: false,
			error: { code: "wrong-action" },
		});
	});

	it("needs the match content loaded with the session", () => {
		const state = { ...drafted(), match: null };
		expect(run(state, "match.play", {})).toMatchObject({
			ok: false,
			error: { code: "invalid-command", params: { path: "match" } },
		});
	});
});
