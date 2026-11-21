import {
	CONTRACT_VERSION,
	decodeFact,
	draftFacts,
	encodeFact,
} from "@rift-legends/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { playSeries } from "../test/play-series";
import { draftDispatcher } from "./index";

const POOL = Array.from({ length: 64 }, (_, i) => `c${i}`);
const options = fc.record({
	seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
	format: fc.constantFrom("bo1" as const, "bo3" as const, "bo5" as const),
	fearless: fc.constantFrom("hard" as const, "soft" as const, "off" as const),
});

type Pick = {
	type: "draft.picked";
	game: number;
	team: string;
	champion: string;
};

describe("series (P1)", () => {
	it("any legal sequence ends in a valid series", () => {
		fc.assert(
			fc.property(options, (o) => {
				const facts = playSeries({ ...o, pool: POOL });
				for (const fact of facts) {
					expect(decodeFact(draftFacts, encodeFact(fact))).toEqual(fact);
				}
				const picks = facts.filter(
					(f) => f.type === "draft.picked",
				) as unknown as Pick[];
				const games = new Set(picks.map((p) => p.game));
				for (const game of games) {
					const champions = picks
						.filter((p) => p.game === game)
						.map((p) => p.champion);
					expect(champions).toHaveLength(10);
					expect(new Set(champions).size).toBe(10);
				}
				const seen = (team?: string) =>
					picks.filter((p) => !team || p.team === team).map((p) => p.champion);
				if (o.fearless === "hard")
					expect(new Set(seen()).size).toBe(seen().length);
				if (o.fearless === "soft") {
					for (const team of ["blue-team", "red-team"]) {
						expect(new Set(seen(team)).size).toBe(seen(team).length);
					}
				}
				const end = facts.at(-1) as unknown as {
					type: string;
					wins: [number, number];
				};
				const needed = { bo1: 1, bo3: 2, bo5: 3 }[o.format];
				expect(end.type).toBe("series.finished");
				expect(end.wins).toContain(needed);
				expect(end.wins.every((w) => w <= needed)).toBe(true);
				expect(games.size).toBe(end.wins[0] + end.wins[1]);
			}),
			{ numRuns: 60 },
		);
		// Sixty whole series, each game simulated (plan 08).
	}, 20_000);
});

describe("rejections (P2)", () => {
	it("leave the session exactly as it was", () => {
		fc.assert(
			fc.property(options, fc.nat(), (o, salt) => {
				let tries = 0;
				playSeries({
					...o,
					pool: POOL,
					probe: (session, view) => {
						tries += 1;
						const other =
							view.turn?.team === view.blue.team
								? view.red.team
								: view.blue.team;
						const taken = view.availability.find((a) => a.status !== "free");
						const attempts = [
							{ kind: "side.choose", payload: { team: other, side: "blue" } },
							{ kind: "draft.ban", payload: { team: other, champion: null } },
							{ kind: "draft.pick", payload: { team: other, champion: "c0" } },
							{
								kind: "draft.pick",
								payload: {
									team: view.turn?.team ?? other,
									champion: taken?.champion ?? "zz",
								},
							},
							{
								kind: "series.start",
								payload: {
									teams: ["a", "b"],
									format: "bo1",
									fearless: "off",
									timer: false,
									pool: POOL,
									seed: 1,
								},
							},
						];
						const illegal = attempts[
							(salt + tries) % attempts.length
						] as (typeof attempts)[number];
						const result = draftDispatcher.handle(session, {
							v: CONTRACT_VERSION,
							sessionId: 1,
							expectedPosition: session.position,
							...illegal,
						});
						expect(result.response.ok).toBe(false);
						expect(result.session).toBe(session);
					},
				});
			}),
			{ numRuns: 30 },
		);
	});
});
