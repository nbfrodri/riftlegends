import {
	CONTRACT_VERSION,
	GAP_RATING,
	seriesSummary,
} from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { fictionalContent } from "../ai/fixtures/content";
import { fictionalMatchContent } from "../match/fixtures/content";
import { openSession, type Session } from "../server/dispatcher";
import { draftDispatcher, draftStateWith } from "./index";
import type { SeriesState } from "./series";
import { summarizeSeries } from "./summary";

const ROLES = ["top", "jungle", "mid", "bot", "support"] as const;

interface Line {
	rating: number;
	gold?: number;
	kills?: number;
	deaths?: number;
	assists?: number;
	participation?: number;
}

/** A `match.ended` fact: blue lines then red lines, in role order. */
const ended = (game: number, blue: Line[], red: Line[]) => ({
	type: "match.ended",
	game,
	winner: "a",
	duration: 1800,
	decisive: [],
	players: [
		...blue.map((l, i) => ({ side: "a", l, i })),
		...red.map((l, i) => ({ side: "b", l, i })),
	].map(({ side, l, i }) => ({
		player: `${side}-${ROLES[i]}`,
		team: side,
		champion: `${side}${game}${i}`,
		kills: l.kills ?? 0,
		deaths: l.deaths ?? 0,
		assists: l.assists ?? 0,
		gold: l.gold ?? 10000,
		damage: 0,
		participation: l.participation ?? 5000,
		rating: l.rating,
	})),
});

const flat = (rating: number): Line[] => ROLES.map(() => ({ rating }));

describe("summarizeSeries (Q5)", () => {
	it("is empty without games", () => {
		expect(summarizeSeries([])).toEqual({ mvp: null, lanes: [] });
	});

	it("picks the player with the best mean rating over the games", () => {
		const blue1 = flat(50);
		blue1[2] = {
			rating: 90,
			kills: 5,
			deaths: 1,
			assists: 3,
			participation: 6000,
		};
		const blue2 = flat(50);
		blue2[2] = {
			rating: 70,
			kills: 1,
			deaths: 2,
			assists: 4,
			participation: 4000,
		};
		blue2[0] = { rating: 80 };
		const summary = summarizeSeries([
			[ended(1, blue1, flat(60))],
			[ended(2, blue2, flat(60))],
		]);
		expect(summary.mvp).toEqual({
			player: "a-mid",
			team: "a",
			champions: ["a12", "a22"],
			// (90 + 70) / 2 = 80.0
			rating: 800,
			kills: 6,
			deaths: 3,
			assists: 7,
			participation: 5000,
			games: 2,
		});
	});

	it("breaks a tie by participation, then by role and side order", () => {
		const blue = flat(40);
		blue[1] = { rating: 80, participation: 4000 };
		const red = flat(40);
		red[3] = { rating: 80, participation: 7000 };
		expect(summarizeSeries([[ended(1, blue, red)]]).mvp?.player).toBe("b-bot");

		blue[1] = { rating: 80, participation: 7000 };
		// Same rating and participation: the earlier role wins.
		expect(summarizeSeries([[ended(1, blue, red)]]).mvp?.player).toBe(
			"a-jungle",
		);
		const tied = flat(40);
		tied[1] = { rating: 80, participation: 7000 };
		// Same role: blue (the first team of the game) wins.
		expect(summarizeSeries([[ended(1, blue, tied)]]).mvp?.player).toBe(
			"a-jungle",
		);
	});

	it("gives the gap of each lane with its sign, and marks it over the threshold", () => {
		const blue = flat(60);
		const red = flat(60);
		blue[0] = { rating: 60 + GAP_RATING + 1, gold: 12000 };
		red[0] = { rating: 60, gold: 9000 };
		blue[4] = { rating: 60 - GAP_RATING, gold: 5000 };
		red[4] = { rating: 60, gold: 5500 };
		const { lanes } = summarizeSeries([[ended(1, blue, red)]]);
		expect(lanes).toHaveLength(1);
		const [top, jungle, , , support] = lanes[0]?.lines ?? [];
		expect(top).toEqual({
			role: "top",
			rating: GAP_RATING + 1,
			gold: 3000,
			favored: "blue",
			gap: true,
		});
		// Exactly the threshold is not a gap; negative favors red.
		expect(support).toEqual({
			role: "support",
			rating: -GAP_RATING,
			gold: -500,
			favored: "red",
			gap: false,
		});
		expect(jungle).toMatchObject({ rating: 0, favored: null, gap: false });
		expect(lanes[0]?.lines.map((l) => l.role)).toEqual([...ROLES]);
	});
});

const send = (s: Session<SeriesState>, kind: string, payload: object) => {
	const result = draftDispatcher.handle(s, {
		v: CONTRACT_VERSION,
		kind,
		sessionId: 1,
		expectedPosition: s.position,
		payload,
	});
	if (!result.response.ok) throw new Error(JSON.stringify(result.response));
	return result.session;
};

const summary = (s: Session<SeriesState>) =>
	draftDispatcher.query(s, {
		v: CONTRACT_VERSION,
		kind: "series.summary",
		sessionId: 1,
		params: {},
	});

describe("series.summary", () => {
	it("is empty before any game and valid after a whole series", () => {
		const ai = { personality: "balanced", difficulty: "normal" };
		let s = openSession<SeriesState>(
			1,
			draftStateWith(fictionalContent, fictionalMatchContent),
		);
		expect(summary(s)).toEqual({ ok: true, view: { mvp: null, lanes: [] } });
		s = send(s, "series.start", {
			teams: ["forge", "shoal"],
			format: "bo3",
			fearless: "off",
			timer: false,
			pool: fictionalContent.champions.map((c) => c.id),
			seed: 3,
			ai: [ai, ai],
		});
		for (let guard = 0; guard < 300 && s.state.phase !== "over"; guard++) {
			s = send(s, s.state.phase === "result" ? "match.play" : "draft.ai", {});
		}
		const answer = summary(s) as { ok: true; view: unknown };
		const view = seriesSummary.parse(answer.view);
		expect(view.lanes.map((g) => g.game)).toEqual(
			s.state.matches.map((_, i) => i + 1),
		);
		expect(view.mvp?.games).toBe(s.state.matches.length);
		// The MVP has the best mean rating of every player in the series.
		const totals = new Map<string, number>();
		for (const facts of s.state.matches) {
			for (const f of facts) {
				if (f.type !== "match.ended") continue;
				for (const p of f.players as { player: string; rating: number }[]) {
					totals.set(p.player, (totals.get(p.player) ?? 0) + p.rating);
				}
			}
		}
		const best = [...totals.values()].reduce((a, b) => (a > b ? a : b));
		expect(totals.get(view.mvp?.player ?? "")).toBe(best);
	});
});
