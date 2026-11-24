import { appendFileSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { BASE_WEIGHTS, PROFILE_DEFINITIONS } from "../ai/profiles";
import { splitOf } from "../calibration/bank";
import { personalityOf, realBank, realContent } from "../calibration/real-bank";
import { replay, type Turn } from "../calibration/replay";
import { formatReport } from "../calibration/report";
import { calibrate, type Setup } from "../calibration/search";

const SEED = 468;
const OUT = process.env.CALIBRATION_OUT ?? "calibration-report.md";
const log = (line: string) =>
	appendFileSync(`${OUT}.log`, `${new Date().toISOString()} ${line}\n`);

// Run only by `pnpm calibrate` (vitest.calibration.config.ts); the name does
// not match `*.test.ts`. Prints the before/after report and the best weights.
test("calibrate the draft AI against pro drafts", {
	timeout: 3_600_000,
}, () => {
	log("start");
	const content = realContent();
	const turns = { train: [] as Turn[], validation: [] as Turn[] };
	let skipped = 0;
	for (const draft of realBank()) {
		const result = replay(draft, content, personalityOf);
		skipped += result.skipped;
		turns[splitOf(draft, SEED)].push(...result.turns);
	}
	log(
		`replayed train=${turns.train.length} validation=${turns.validation.length} skipped=${skipped}`,
	);
	const start: Setup = {
		base: BASE_WEIGHTS,
		own: Object.fromEntries(
			Object.entries(PROFILE_DEFINITIONS).map(([p, d]) => [p, d.weights]),
		),
	};
	const result = calibrate({ ...turns, start, seed: SEED });
	const out = [
		`skipped turns: ${skipped}; accepted: ${result.accepted}`,
		formatReport("Entrenamiento antes", result.train.before),
		formatReport("Entrenamiento después", result.train.after),
		formatReport("Validación antes", result.validation.before),
		formatReport("Validación después", result.validation.after),
		`base: ${JSON.stringify(result.setup.base)}`,
		`own: ${JSON.stringify(result.setup.own)}`,
	];
	writeFileSync(OUT, `${out.join("\n\n")}\n`);
	log("done");
});
