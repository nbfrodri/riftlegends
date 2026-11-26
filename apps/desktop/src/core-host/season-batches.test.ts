import { expect, test } from "vitest";
import { accepted, client, season } from "./season.fixtures";

// A day can be played a few series at a time (#584) so that no single request
// keeps the core busy for long: same facts and same season as the whole day.

const open = () => {
	const core = client();
	accepted(core.send("season.create", season));
	return core;
};

test("a day played in batches gives the facts and the season of the whole day", () => {
	const whole = open();
	const all = accepted(whole.send("season.playDay", { day: 0 })).facts;

	const core = open();
	const first = accepted(core.send("season.playDay", { day: 0, maxSeries: 1 }));
	expect(
		first.facts.some(({ type }) => type === "competition.stageFinished"),
	).toBe(false);
	expect(core.query("season.overview", {})).toMatchObject({ view: { day: 0 } });
	const second = accepted(
		core.send("season.playDay", { day: 0, maxSeries: 1 }),
	);
	expect([...first.facts, ...second.facts]).toEqual(all);
	expect(core.query("competition.schedule", {})).toEqual(
		whole.query("competition.schedule", {}),
	);
	expect(core.query("season.overview", {})).toEqual(
		whole.query("season.overview", {}),
	);
});

test("a batch is idempotent by position and the next day waits for the rest", () => {
	const core = open();
	const start = core.position();
	const first = core.send("season.playDay", { day: 0, maxSeries: 1 });
	expect(core.send("season.playDay", { day: 0, maxSeries: 1 }, start)).toEqual(
		first,
	);
	expect(core.send("season.playDay", { day: 1 })).toMatchObject({ ok: false });
});
