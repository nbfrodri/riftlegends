import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
		copyFileSync(
			new URL("fixtures/forbidden.ts", import.meta.url),
			join(core, "forbidden.ts"),
		);

		const result = spawnSync(
			execPath,
			[
				biome,
				"lint",
				"--vcs-enabled=false",
				"--reporter=json",
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
			.map(({ category, location }) => [location.start.line, category]);

		expect(errors).toHaveLength(9);
		expect(errors).toEqual(
			expect.arrayContaining([
				[1, "lint/style/noRestrictedImports"],
				[2, "lint/style/noRestrictedImports"],
				[3, "lint/style/noRestrictedImports"],
				[5, "lint/style/noRestrictedGlobals"],
				[6, "lint/style/noRestrictedGlobals"],
				[7, "lint/style/noRestrictedGlobals"],
				[8, "lint/style/noRestrictedGlobals"],
				[11, "lint/style/noRestrictedImports"],
				[12, "lint/style/noRestrictedImports"],
			]),
		);
		expect(result.status).toBe(1);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
