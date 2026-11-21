import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CONTENT_VERSION, SIM_VERSION } from "../version";
import {
	assertGolden,
	coherenceProblems,
	GOLDENS_DIR,
	type GoldenCase,
	renderGolden,
	writeGoldens,
} from "./golden";
import { goldenCases } from "./golden-cases";

const V1 = { sim: 1, content: 0 };
const V2 = { sim: 2, content: 0 };
const tmp = () => mkdtempSync(join(tmpdir(), "rift-goldens-"));
const facts = (value: number) => [
	{ type: "roll", position: 0, value },
	{ type: "roll", position: 1, value: value + 1 },
];
const aCase = (value: number): GoldenCase => ({
	module: "demo",
	seed: 7,
	facts: () => facts(value),
});

describe("golden file", () => {
	test("has a one-line version header followed by the canonical log", () => {
		expect(renderGolden(facts(5), V1)).toBe(
			'# sim_version=1 content_version=0\n{"position":0,"type":"roll","value":5}\n{"position":1,"type":"roll","value":6}\n',
		);
	});
});

describe("assertGolden (D1, D2)", () => {
	test("passes when the log matches the golden byte for byte", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(() => assertGolden("demo", 7, facts(5), dir, V1)).not.toThrow();
	});

	test("fails with seed, line and difference when a byte differs", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(() => assertGolden("demo", 7, facts(9), dir, V1)).toThrow(
			/seed 7[\s\S]*line 2[\s\S]*"value":5[\s\S]*"value":9/,
		);
	});

	test("fails, without creating the file, when the golden is missing", () => {
		const dir = tmp();
		expect(() => assertGolden("demo", 7, facts(5), dir, V1)).toThrow(
			/missing[\s\S]*goldens:update/,
		);
		expect(() => readFileSync(join(dir, "demo", "7.golden"))).toThrow();
	});

	test("fails when the header versions differ from the current ones", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(() => assertGolden("demo", 7, facts(5), dir, V2)).toThrow(/line 1/);
	});
});

describe("coherence (D3)", () => {
	test("is clean right after an update", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(coherenceProblems(dir, V1)).toEqual([]);
	});

	test("reports bytes changed by hand without a sim_version bump", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		const file = join(dir, "demo", "7.golden");
		writeFileSync(file, readFileSync(file, "utf8").replace("5", "6"));
		expect(coherenceProblems(dir, V1)).toEqual([
			expect.stringMatching(/demo\/7\.golden[\s\S]*changed/),
		]);
	});

	test("reports a sim_version bump whose goldens were not regenerated", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(coherenceProblems(dir, V2)).not.toEqual([]);
	});

	test("reports a golden missing from the manifest", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		mkdirSync(join(dir, "demo"), { recursive: true });
		writeFileSync(join(dir, "demo", "8.golden"), "x\n");
		expect(coherenceProblems(dir, V1)).toEqual([
			expect.stringMatching(/demo\/8\.golden[\s\S]*manifest/),
		]);
	});

	test("update refuses to change bytes while sim_version stays the same", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		expect(() => writeGoldens([aCase(9)], dir, V1)).toThrow(/SIM_VERSION/);
		expect(readFileSync(join(dir, "demo", "7.golden"), "utf8")).toContain(
			'"value":5',
		);
	});

	test("update accepts changed bytes once sim_version is bumped", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		writeGoldens([aCase(9)], dir, V2);
		expect(coherenceProblems(dir, V2)).toEqual([]);
		expect(() => assertGolden("demo", 7, facts(9), dir, V2)).not.toThrow();
	});

	test("update leaves unchanged goldens untouched and is idempotent", () => {
		const dir = tmp();
		writeGoldens([aCase(5)], dir, V1);
		const before = readFileSync(join(dir, "demo", "7.golden"));
		writeGoldens([aCase(5)], dir, V1);
		expect(readFileSync(join(dir, "demo", "7.golden"))).toEqual(before);
	});
});

describe("committed goldens", () => {
	test("exist for the example cases", () => {
		expect(goldenCases.map((c) => `${c.module}/${c.seed}`)).toEqual([
			"rng/0",
			"rng/2",
			"rng/4294967295",
			"draft/2026",
			"draft-ai/7",
		]);
	});

	test("are coherent with SIM_VERSION and CONTENT_VERSION", () => {
		expect(coherenceProblems(GOLDENS_DIR)).toEqual([]);
	});

	test.each(goldenCases)("$module seed $seed matches its golden", (c) => {
		expect(() =>
			assertGolden(c.module, c.seed, c.facts(), GOLDENS_DIR),
		).not.toThrow();
	});

	test("are stored with LF line endings", () => {
		for (const c of goldenCases) {
			const file = join(GOLDENS_DIR, c.module, `${c.seed}.golden`);
			expect(readFileSync(file).includes(13)).toBe(false);
		}
		expect(SIM_VERSION).toBeGreaterThan(0);
		expect(CONTENT_VERSION).toBeGreaterThanOrEqual(0);
	});
});
