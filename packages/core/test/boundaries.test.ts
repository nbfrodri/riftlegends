import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { expect, test } from "vitest";

interface BiomeDiagnostic {
	category: string;
	severity: string;
	location: { start: { line: number } };
}

test("rejects nondeterminism and platform dependencies in core", () => {
	const biome = createRequire(import.meta.url).resolve(
		"@biomejs/biome/bin/biome",
	);
	const workspace = mkdtempSync(join(tmpdir(), "rift-core-boundaries-"));
	const core = join(workspace, "packages", "core");
	try {
		mkdirSync(core, { recursive: true });
		copyFileSync(
			new URL("../../../biome.json", import.meta.url),
			join(workspace, "biome.json"),
		);
		const fixture = new URL("fixtures/forbidden.ts", import.meta.url);
		copyFileSync(fixture, join(core, "forbidden.ts"));

		const result = spawnSync(
			execPath,
			[
				biome,
				"lint",
				"--vcs-enabled=false",
				"--reporter=json",
				"--max-diagnostics=none",
				"packages/core/forbidden.ts",
			],
			{ cwd: workspace, encoding: "utf8", timeout: 5_000 },
		);
		expect(result.error).toBeUndefined();
		const report: { diagnostics: BiomeDiagnostic[] } = JSON.parse(
			result.stdout,
		);
		const errors = report.diagnostics
			.filter(({ severity }) => severity === "error")
			.sort((a, b) => a.location.start.line - b.location.start.line)
			.map(({ category, location }) => [location.start.line, category]);
		const expected = readFileSync(fixture, "utf8")
			.split(/\r?\n/)
			.flatMap((line, index) => {
				const rule = line.match(/\/\/ (noRestricted\w+)$/)?.[1];
				return rule ? [[index + 1, `lint/style/${rule}`]] : [];
			});
		expect(errors).toEqual(expected);
		expect(result.status).toBe(1);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
