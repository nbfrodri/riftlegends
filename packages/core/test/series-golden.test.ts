import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	canonicalLog,
	finishSeries,
	nextTurn,
	playTurn,
	seedFor,
	startSeries,
} from "../index";

const blue = "Sable Choir";
const red = "Copper Wake";

test.each([
	{ seed: 0, wins: [0, 2] },
	{ seed: 2, wins: [2, 1] },
	{ seed: 4294967295, wins: [1, 2] },
])(
	"seed $seed matches the full golden and stops on the second win",
	({ seed, wins }) => {
		const series = finishSeries(startSeries(seed, 75));
		const expected = readFileSync(
			new URL(`./goldens/${seed}.golden`, import.meta.url),
		);
		expect(Buffer.from(canonicalLog(series.facts), "utf8")).toEqual(expected);
		expect(series.wins).toEqual({ [blue]: wins[0], [red]: wins[1] });
		expect(series.game.id).toBe(series.wins[blue] + series.wins[red]);
		const finalState = structuredClone(series);
		expect(playTurn(series, "ban", blue)).toBe("series-finished");
		expect(series).toEqual(finalState);
	},
);

test("illegal commands preserve both RNG streams, the turn and all facts", () => {
	const series = startSeries(2, 75);
	function reject(
		action: "pick" | "ban",
		team: typeof blue | typeof red,
		champion: string | undefined,
		reason: string,
	) {
		const before = structuredClone(series);
		expect(playTurn(series, action, team, champion)).toBe(reason);
		expect(series).toEqual(before);
	}
	reject("ban", red, undefined, "wrong-turn");
	reject("pick", blue, "Ashloom", "wrong-turn");
	reject("ban", blue, "Unknown", "unknown-champion");
	expect(playTurn(series, "ban", blue, "Ashloom")).toBe("accepted");
	reject("ban", red, "Ashloom", "banned");
	for (const team of [red, blue, red, blue, red] as const) {
		expect(playTurn(series, "ban", team)).toBe("accepted");
	}
	reject("pick", blue, "Ashloom", "banned");
	expect(playTurn(series, "pick", blue)).toBe("accepted");
	const picked = series.game.picks[0];
	expect(picked).toBeDefined();
	reject("pick", red, picked, "already-picked");
});

test("a JSON checkpoint after a turn resumes both streams and the same series", () => {
	const series = startSeries(2, 75);
	for (let i = 0; i < 27; i++) {
		const turn = nextTurn(series);
		if (!turn) throw new Error("Unexpected series end");
		expect(playTurn(series, ...turn)).toBe("accepted");
	}
	const restored = JSON.parse(JSON.stringify(series));
	expect(finishSeries(restored)).toEqual(finishSeries(series));
});

test("the input encoding pins independent seed, scope, series and game vectors", () => {
	expect(seedFor(0, "draft", 75, 1)).toBe(4035426286);
	expect(seedFor(2, "draft", 75, 1)).toBe(2489897068);
	expect(seedFor(2, "match", 75, 1)).toBe(469212319);
	expect(seedFor(2, "draft", 76, 1)).toBe(480063787);
	expect(seedFor(2, "draft", 75, 2)).toBe(2230160799);
	expect(seedFor(4294967295, "draft", 75, 1)).toBe(3450904650);
});
