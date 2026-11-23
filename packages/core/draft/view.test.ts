import { draftView } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { takeSides } from "../test/take-sides";
import { initialSeries, type SeriesState, seriesCommands } from "./series";
import { viewDraft } from "./view";

const POOL = Array.from({ length: 30 }, (_, i) => `c${i}`);

const ok = (outcome: ReturnType<(typeof seriesCommands)["series.start"]>) => {
	if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
	return outcome.state;
};

const started = (): SeriesState =>
	ok(
		seriesCommands["series.start"](initialSeries, {
			teams: ["t1", "geng"],
			format: "bo1",
			fearless: "soft",
			timer: false,
			pool: POOL,
			seed: 3,
		}),
	);

describe("draft.view (F7)", () => {
	it("is empty before the series starts", () => {
		expect(viewDraft(initialSeries, {})).toBeNull();
	});

	it("asks the team with priority for a side choice", () => {
		const state = started();
		const view = viewDraft(state, {});
		expect(draftView.parse(view)).toMatchObject({
			game: 1,
			phase: "side",
			turn: { team: state.chooser, action: "side" },
			choices: [],
			first: null,
		});
	});

	it("shows turn, bans, picks and why each champion is not free", () => {
		let state = takeSides(started(), "t1");
		state = ok(
			seriesCommands["draft.ban"](state, { team: "t1", champion: "c1" }),
		);
		state = ok(
			seriesCommands["draft.ban"](state, { team: "geng", champion: null }),
		);
		const view = draftView.parse(viewDraft(state, {}));
		expect(view).toMatchObject({
			phase: "bans1",
			turn: { team: "t1", side: "blue", action: "ban" },
			first: "blue",
			blue: { team: "t1", bans: ["c1"], picks: [] },
			red: { team: "geng", bans: [null], picks: [] },
		});
		expect(view.availability).toHaveLength(POOL.length);
		expect(view.availability[1]).toEqual({ champion: "c1", status: "banned" });
		expect(view.availability[0]).toEqual({ champion: "c0", status: "free" });
	});
});
