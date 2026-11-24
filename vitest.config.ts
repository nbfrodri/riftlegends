import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "data-pipeline",
					include: ["tools/data-pipeline/**/*.test.ts"],
				},
			},
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
					// The asset cache tests write real files; on Windows CI the
					// split files run in parallel and pass 5 s (#441).
					testTimeout: 20_000,
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
					name: "contracts",
					include: ["packages/contracts/**/*.test.ts"],
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
