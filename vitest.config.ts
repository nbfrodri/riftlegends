import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "desktop",
					include: ["apps/desktop/**/*.test.{ts,tsx}"],
				},
			},
			{
				test: {
					name: "core",
					include: ["packages/core/**/*.test.ts"],
				},
			},
		],
	},
});
