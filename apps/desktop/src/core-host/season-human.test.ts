import { competitionFacts, ROLES } from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { accepted, client, season } from "./season.fixtures";

type Core = ReturnType<typeof client>;
type Fact = Record<string, unknown> & { type: string };

const human = { ...season, humanTeam: "forge" };
const factsOf = (core: Core, kind: string, payload: object): Fact[] =>
	(accepted(core.send(kind, payload)) as { facts: Fact[] }).facts;
const schedule = (core: Core) => {
	const result = core.query("competition.schedule", { team: "forge" });
	if (!("view" in result)) throw new Error("no schedule");
	return result.view as { id: string; day: number; status: string }[];
};
const draftView = (core: Core) => {
	const result = core.query("draft.view", {});
	if (!("view" in result)) throw new Error("no draft view");
	return result.view as {
		turn: { team: string; action: string; options?: string[] } | null;
		phase: string;
		blue: { team: string; picks: string[] };
		red: { team: string; picks: string[] };
		availability: { champion: string; status: string }[];
	};
};

/** The user's team picks the first free champion and takes the first side. */
function playHuman(core: Core, series: string): Fact[] {
	const facts = factsOf(core, "season.playSeries", { series });
	for (let guard = 0; guard < 400; guard++) {
		if (facts.some(({ type }) => type === "competition.seriesRecorded"))
			return facts;
		const view = draftView(core);
		const turn = view.turn;
		if (view.phase === "result") {
			facts.push(...factsOf(core, "match.play", {}));
		} else if (turn?.team !== "forge") {
			facts.push(...factsOf(core, "draft.ai", {}));
		} else if (turn.action === "side") {
			facts.push(
				...factsOf(core, "side.choose", {
					team: "forge",
					choice: turn.options?.[0],
				}),
			);
		} else if (turn.action === "ban") {
			facts.push(
				...factsOf(core, "draft.ban", { team: "forge", champion: null }),
			);
		} else if (turn.action === "pick") {
			const free = view.availability.find(({ status }) => status === "free");
			facts.push(
				...factsOf(core, "draft.pick", {
					team: "forge",
					champion: free?.champion,
				}),
			);
		} else {
			const mine = view.blue.team === "forge" ? view.blue : view.red;
			const roles = Object.fromEntries(
				ROLES.map((role, index) => [role, mine.picks[index]]),
			);
			facts.push(...factsOf(core, "draft.roles", { team: "forge", roles }));
		}
	}
	throw new Error("the series never ended");
}

function dayZero() {
	const core = client();
	accepted(core.send("season.create", human));
	const day = factsOf(core, "season.playDay", { day: 0 });
	return { core, day };
}

test("Q7: playDay plays the AI series and leaves the user's one pending", () => {
	const { core, day } = dayZero();
	const recorded = day.filter(
		({ type }) => type === "competition.seriesRecorded",
	);
	expect(recorded).toHaveLength(1);
	expect(recorded[0]?.teams).not.toContain("forge");
	const pending = day.filter(
		({ type }) => type === "competition.seriesPending",
	);
	expect(pending).toHaveLength(1);
	expect(pending[0]).toMatchObject({ day: 0, competition: "league" });
	expect(pending[0]?.teams).toContain("forge");
	for (const fact of day.filter(({ type }) =>
		type.startsWith("competition."),
	)) {
		expect(competitionFacts.schema.safeParse(fact).success, fact.type).toBe(
			true,
		);
	}
	expect(schedule(core)).toMatchObject([{ day: 0, status: "ready" }]);
});

test("Q7: the day stays open until the user plays, and a repeat plays nothing twice", () => {
	const { core, day } = dayZero();
	const position = core.position();
	// A retry with the old position is answered from the first response.
	expect(
		core.send("season.playDay", { day: 0 }, position - day.length),
	).toMatchObject({ ok: true, facts: day });
	// A new command for the same day has nothing left to play.
	expect(core.send("season.playDay", { day: 0 })).toMatchObject({
		ok: false,
		error: { code: "wrong-action" },
	});
	expect(core.send("season.playDay", { day: 1 })).toMatchObject({ ok: false });
	expect(core.position()).toBe(position);
});

test("Q7: the user's team must be one of the teams", () => {
	const core = client();
	expect(
		core.send("season.create", { ...season, humanTeam: "nobody" }),
	).toMatchObject({ ok: false, error: { code: "invalid-format" } });
});

test("Q8: playSeries rejects a series that is not pending", () => {
	const { core } = dayZero();
	const position = core.position();
	expect(core.send("season.playSeries", { series: "nope" })).toMatchObject({
		ok: false,
		error: { code: "unknown-series" },
	});
	expect(core.position()).toBe(position);
	const fresh = client();
	accepted(fresh.send("season.create", human));
	expect(fresh.send("season.playSeries", { series: "any" })).toMatchObject({
		ok: false,
	});
});

test("Q8: the user's series is played with the draft flow and recorded like the AI's", () => {
	const { core } = dayZero();
	const [slot] = schedule(core);
	const facts = playHuman(core, slot?.id as string);
	const started = facts[0] as Fact;
	const ai = started.ai as unknown[];
	expect(started.type).toBe("series.started");
	expect([...ai].sort()).toEqual(["coach", null].sort());
	expect(ai[(started.teams as string[]).indexOf("forge")]).toBeNull();
	const recorded = facts.find(
		({ type }) => type === "competition.seriesRecorded",
	) as Fact;
	expect(recorded).toMatchObject({
		type: "competition.seriesRecorded",
		competition: "league",
		day: 0,
		tiebreaker: false,
	});
	expect(competitionFacts.schema.safeParse(recorded).success).toBe(true);
	const finished = facts.find(({ type }) => type === "series.finished");
	expect(finished).toBeDefined();
	expect(recorded.winner).toBe(finished?.winner);
	expect(schedule(core)).toMatchObject([
		{ status: "played", winner: recorded.winner, score: recorded.score },
	]);
	const summary = core.query("series.summary", { series: slot?.id });
	expect(summary).toMatchObject({ ok: true });
	// The day is closed: with its last series played the stage is finished.
	expect(facts.map(({ type }) => type)).toContain("competition.stageFinished");
	expect(core.query("season.overview", {})).toMatchObject({
		ok: true,
		view: { day: null },
	});
	expect(core.send("season.playSeries", { series: slot?.id })).toMatchObject({
		ok: false,
	});
});

test("Q8: same seed and same decisions give the same log of facts", () => {
	const logs = [0, 1].map(() => {
		const { core, day } = dayZero();
		const [slot] = schedule(core);
		return [...day, ...playHuman(core, slot?.id as string)];
	});
	expect(logs[1]).toEqual(logs[0]);
	expect(logs[0]?.map(({ type }) => type)).toContain(
		"competition.seriesRecorded",
	);
});
