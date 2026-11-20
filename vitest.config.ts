import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "ui-kit",
					include: ["packages/ui-kit/**/*.test.ts"],
				},
			},
			{
				test: {
					name: "ui-kit-dom",
					include: ["packages/ui-kit/**/*.test.tsx"],
					environment: "happy-dom",
					setupFiles: ["packages/ui-kit/test/layout.ts"],
				},
			},
			{
				test: {
					name: "desktop",
					include: ["apps/desktop/**/*.test.ts"],
				},
			},
			{
				test: {
					name: "desktop-dom",
					include: ["apps/desktop/**/*.test.tsx"],
					environment: "happy-dom",
					setupFiles: ["packages/ui-kit/test/layout.ts"],
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
