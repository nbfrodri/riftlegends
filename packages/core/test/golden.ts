import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeLog } from "@rift-legends/contracts";
import { CONTENT_VERSION, SIM_VERSION } from "../version";

/**
 * Golden harness (plan 05, D1-D3). A golden is `<module>/<seed>.golden`:
 * one header line with the versions, then the canonical fact log. Tests only
 * read goldens; `pnpm goldens:update` is the only writer. `manifest.json`
 * binds the hash of every golden body to the `sim_version` it was made with.
 */

export const GOLDENS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"goldens",
);
const MANIFEST = "manifest.json";

export interface Versions {
	sim: number;
	content: number;
}
const CURRENT: Versions = { sim: SIM_VERSION, content: CONTENT_VERSION };

export interface GoldenCase {
	module: string;
	seed: number;
	facts(): readonly object[];
}

interface Manifest {
	sim_version: number;
	goldens: Record<string, string>;
}

const header = (v: Versions) =>
	`# sim_version=${v.sim} content_version=${v.content}\n`;
const sha256 = (text: string) =>
	createHash("sha256").update(text).digest("hex");
const relative = (module: string, seed: number) => `${module}/${seed}.golden`;

export const renderGolden = (
	facts: readonly object[],
	versions: Versions = CURRENT,
): string => header(versions) + encodeLog(facts);

const body = (golden: string) => golden.slice(golden.indexOf("\n") + 1);

/** First differing line, 1-based, counting the header. */
const firstDifference = (expected: string, actual: string) => {
	const a = expected.split("\n");
	const b = actual.split("\n");
	const length = Math.max(a.length, b.length);
	for (let i = 0; i < length; i++) {
		if (a[i] !== b[i]) {
			return `line ${i + 1}\n  golden: ${a[i] ?? "<end of file>"}\n  actual: ${b[i] ?? "<end of file>"}`;
		}
	}
	return "no difference";
};

/** Fails (never creates) when the log differs from its golden. */
export function assertGolden(
	module: string,
	seed: number,
	facts: readonly object[],
	dir: string = GOLDENS_DIR,
	versions: Versions = CURRENT,
): void {
	const file = join(dir, module, `${seed}.golden`);
	if (!existsSync(file)) {
		throw new Error(
			`Golden missing for ${module}, seed ${seed}: ${file}. Run \`pnpm goldens:update\`.`,
		);
	}
	const expected = readFileSync(file, "utf8");
	const actual = renderGolden(facts, versions);
	if (expected !== actual) {
		throw new Error(
			`Golden mismatch for ${module}, seed ${seed}, at ${firstDifference(expected, actual)}`,
		);
	}
}

const readManifest = (dir: string): Manifest | undefined => {
	const file = join(dir, MANIFEST);
	return existsSync(file)
		? (JSON.parse(readFileSync(file, "utf8")) as Manifest)
		: undefined;
};

/**
 * Regenerates the goldens and the manifest. Refuses to change the bytes of an
 * existing golden unless `sim_version` was bumped since the manifest was made.
 */
export function writeGoldens(
	cases: readonly GoldenCase[],
	dir: string = GOLDENS_DIR,
	versions: Versions = CURRENT,
): void {
	const previous = readManifest(dir);
	const goldens: Record<string, string> = {};
	const files = new Map<string, string>();
	const changed: string[] = [];
	for (const c of cases) {
		const name = relative(c.module, c.seed);
		const text = renderGolden(c.facts(), versions);
		goldens[name] = sha256(body(text));
		files.set(name, text);
		const old = previous?.goldens[name];
		if (old !== undefined && old !== goldens[name]) changed.push(name);
	}
	if (changed.length > 0 && previous?.sim_version === versions.sim) {
		throw new Error(
			`Golden bytes changed (${changed.join(", ")}) but SIM_VERSION is still ${versions.sim}. Bump SIM_VERSION and explain why in the PR.`,
		);
	}
	for (const [name, text] of files) {
		const file = join(dir, name);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
	const manifest: Manifest = { sim_version: versions.sim, goldens };
	writeFileSync(
		join(dir, MANIFEST),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
}

const goldenFiles = (dir: string): string[] =>
	existsSync(dir)
		? readdirSync(dir, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.flatMap((entry) =>
					readdirSync(join(dir, entry.name))
						.filter((name) => name.endsWith(".golden"))
						.map((name) => `${entry.name}/${name}`),
				)
				.sort()
		: [];

/** D3: what is wrong between the goldens on disk, the manifest and the versions. */
export function coherenceProblems(
	dir: string = GOLDENS_DIR,
	versions: Versions = CURRENT,
): string[] {
	const manifest = readManifest(dir);
	if (!manifest)
		return [`${MANIFEST} is missing. Run \`pnpm goldens:update\`.`];
	const problems: string[] = [];
	if (manifest.sim_version !== versions.sim) {
		problems.push(
			`SIM_VERSION is ${versions.sim} but the manifest was made with ${manifest.sim_version}. Run \`pnpm goldens:update\`.`,
		);
	}
	const onDisk = goldenFiles(dir);
	for (const name of onDisk) {
		const recorded = manifest.goldens[name];
		if (recorded === undefined) {
			problems.push(`${name} is not in the manifest.`);
			continue;
		}
		const text = readFileSync(join(dir, name), "utf8");
		if (sha256(body(text)) !== recorded) {
			problems.push(
				`${name} changed without bumping SIM_VERSION (${versions.sim}).`,
			);
		}
		if (text.split("\n", 1)[0] !== header(versions).trimEnd()) {
			problems.push(
				`${name} has a header that differs from the current versions.`,
			);
		}
	}
	for (const name of Object.keys(manifest.goldens)) {
		if (!onDisk.includes(name))
			problems.push(`${name} is in the manifest but missing.`);
	}
	return problems;
}
