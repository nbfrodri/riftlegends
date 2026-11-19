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
					name: "i18n",
					include: ["packages/i18n/**/*.test.{ts,tsx}"],
					environment: "happy-dom",
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
