import type { MatchContent, Side } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { edge } from "./contests/edge";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMinute } from "./loop";
import { createMatch, type MatchSetup, other } from "./state";

const SEEDS = 1200;
const CHECKPOINT = 20;
const LEAD = 3000;
type Risk = ReturnType<
	typeof createMatch
>["context"]["blue"]["strategy"]["risk"];

function withRisk(blue: Risk, red: Risk) {
	const setup = matchSetup();
	return {
		...setup.match,
		teams: setup.match.teams.map((team) => ({
			...team,
			strategy: {
				...team.strategy,
				risk: team.id === setup.blue.team ? blue : red,
			},
		})),
	};
}

/**
 * Plays only what the metric reads: the gold gap through the checkpoint, and
 * the rest of the game only for the games that were already decided by gold.
 * Same events and winners as `playMatch`, without snapshots or the tail of
 * the games that do not count.
 */
function playUntilDecided(setup: MatchSetup) {
	let state = createMatch(setup);
	let gap = 0;
	while (state.winner === null && state.minute < CHECKPOINT) {
		const next = playMinute(state, MATCH_CONTESTS);
		for (const event of next.events) {
			if (event.minute <= CHECKPOINT) gap += event.gold.blue - event.gold.red;
		}
		state = next.state;
	}
	const decided = state.minute >= CHECKPOINT && (gap >= LEAD || gap <= -LEAD);
	if (decided) {
		while (state.winner === null) {
			state = playMinute(state, MATCH_CONTESTS).state;
		}
	}
	return { gap, state, counted: decided };
}

function measure(match: MatchContent, side?: Side) {
	let trailed = 0;
	let led = 0;
	let comebacks = 0;
	let throws = 0;
	for (let seed = 0; seed < SEEDS; seed++) {
		const { gap, state, counted } = playUntilDecided(
			matchSetup({ seed, match }),
		);
		if (!counted) continue;
		const leader = gap > 0 ? "blue" : "red";
		if (side === undefined || side === other(leader)) {
			trailed++;
			if (state.winner !== leader) comebacks++;
		}
		if (side === undefined || side === leader) {
			led++;
			if (state.winner !== leader) throws++;
		}
	}
	return { trailed, led, comebacks, throws };
}

it("F13 · a risky team comes back and throws more often than the same safe team", () => {
	const safe = measure(withRisk("safe", "balanced"), "blue");
	const risky = measure(withRisk("risky", "balanced"), "blue");
	const rates = (sample: typeof safe) => ({
		comeback: sample.comebacks / sample.trailed,
		throw: sample.throws / sample.led,
	});
	console.info("F13", {
		safe,
		risky,
		rates: { safe: rates(safe), risky: rates(risky) },
	});
	expect(rates(risky).comeback).toBeGreaterThan(rates(safe).comeback);
	expect(rates(risky).throw).toBeGreaterThan(rates(safe).throw);
}, 30_000);

it("K4 · minute-20 comebacks from at least 3,000 gold down stay within 15–30%", () => {
	const { comebacks, trailed } = measure(matchSetup().match);
	const rate = comebacks / trailed;
	console.info("K4", { comebacks, trailed, rate });
	expect(trailed).toBeGreaterThan(300);
	expect(rate).toBeGreaterThanOrEqual(0.15);
	expect(rate).toBeLessThanOrEqual(0.3);
}, 30_000);

it("scales either team's edge symmetrically and explains the adjustment", () => {
	const initial = createMatch(matchSetup());
	const state = {
		...initial,
		minute: 20,
		blue: { ...initial.blue, paid: [600, 600, 600, 600, 600] },
	};
	const context = (risk: Risk) => ({
		...state.context,
		blue: {
			...state.context.blue,
			strategy: { ...state.context.blue.strategy, risk },
		},
		red: {
			...state.context.red,
			strategy: { ...state.context.red.strategy, risk: "balanced" as const },
		},
	});
	const result = (risk: Risk) =>
		edge({ ...state, context: context(risk) }, "fight");
	const safe = result("safe");
	const balanced = result("balanced");
	const risky = result("risky");
	expect(safe.blue).toBeGreaterThan(balanced.blue);
	expect(risky.blue).toBeLessThan(balanced.blue);
	const riskPoints = (result: ReturnType<typeof edge>) =>
		result.causes.find((cause) => cause.key === "risk")?.points ?? 0;
	expect(riskPoints(safe)).toBeGreaterThan(0);
	expect(riskPoints(risky)).toBeLessThan(0);
	const riskyContext = context("risky");
	const swapped = edge(
		{
			...state,
			blue: state.red,
			red: state.blue,
			context: {
				...riskyContext,
				blue: riskyContext.red,
				red: riskyContext.blue,
			},
		},
		"fight",
	);
	expect(swapped.blue + risky.blue).toBe(10000);
	expect(riskPoints(swapped)).toBe(-riskPoints(risky));
});
