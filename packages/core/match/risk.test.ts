import type { MatchContent, Side } from "@rift-legends/contracts";
import { expect, it } from "vitest";
import { edge } from "./contests/edge";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { createMatch, other } from "./state";

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

function measure(match: MatchContent, side?: Side) {
	let trailed = 0;
	let led = 0;
	let comebacks = 0;
	let throws = 0;
	for (let seed = 0; seed < SEEDS; seed++) {
		const { state, events } = playMatch(
			matchSetup({ seed, match }),
			MATCH_CONTESTS,
		);
		if (state.minute < CHECKPOINT) continue;
		const gap = events.reduce(
			(sum, event) =>
				event.minute <= CHECKPOINT
					? sum + event.gold.blue - event.gold.red
					: sum,
			0,
		);
		if (gap < LEAD && gap > -LEAD) continue;
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
}, 15_000);

it("K4 · minute-20 comebacks from at least 3,000 gold down stay within 15–30%", () => {
	const { comebacks, trailed } = measure(matchSetup().match);
	const rate = comebacks / trailed;
	console.info("K4", { comebacks, trailed, rate });
	expect(trailed).toBeGreaterThan(300);
	expect(rate).toBeGreaterThanOrEqual(0.15);
	expect(rate).toBeLessThanOrEqual(0.3);
}, 15_000);

it("scales either team's edge symmetrically and explains the adjustment", () => {
	const initial = createMatch(matchSetup());
	const state = {
		...initial,
		minute: 20,
		blue: { ...initial.blue, gold: 3000 },
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
