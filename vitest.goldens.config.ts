import { defineConfig } from "vitest/config";

export default defineConfig({
	test: { include: ["packages/core/test/update-goldens.script.ts"] },
});
