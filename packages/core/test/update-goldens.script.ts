import { test } from "vitest";
import { writeGoldens } from "./golden";
import { goldenCases } from "./golden-cases";

// Run only by `pnpm goldens:update` (vitest.goldens.config.ts). Its name does
// not match `*.test.ts`, so `pnpm test` never regenerates anything.
test("regenerate goldens", () => {
	writeGoldens(goldenCases);
});
