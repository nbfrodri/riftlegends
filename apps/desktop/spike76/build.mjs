import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, Platform } from "electron-builder";
import { build as bundle } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const version = process.argv[2];
if (!["0.76.1", "0.76.2"].includes(version))
	throw Error("Expected 0.76.1 or 0.76.2");
const stage = join(root, "out", "spike76", version);
mkdirSync(stage, { recursive: true });
await bundle({
	configFile: false,
	build: {
		outDir: stage,
		lib: {
			entry: join(root, "packages/core/index.ts"),
			formats: ["cjs"],
			fileName: () => "core.cjs",
		},
	},
});
for (const name of [
	"main.cjs",
	"client.cjs",
	"writer.cjs",
	"checks.cjs",
	"index.html",
	"preload.cjs",
	"screen.js",
]) {
	copyFileSync(join(here, name), join(stage, name));
}
for (const locale of ["es", "en"]) {
	copyFileSync(
		join(root, "packages/i18n/locales", `${locale}.json`),
		join(stage, `${locale}.json`),
	);
}
for (const seed of [0, 2, 4294967295]) {
	copyFileSync(
		join(root, "packages/core/test/goldens", `${seed}.golden`),
		join(stage, `${seed}.golden`),
	);
}
writeFileSync(
	join(stage, "package.json"),
	JSON.stringify({
		name: "rift-legends-spike76",
		version,
		main: "main.cjs",
		author: "Rift Legends",
		description: "Rift Legends packaging and career recovery spike",
	}),
);
const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
await build({
	projectDir: stage,
	publish: "never",
	targets:
		process.platform === "win32"
			? Platform.WINDOWS.createTarget("nsis")
			: Platform.LINUX.createTarget("AppImage"),
	config: {
		appId: "org.riftlegends.spike76",
		productName: "Rift Legends Spike",
		electronVersion,
		toolsets: { appimage: "1.0.3" },
		electronDist: dirname(require("electron")),
		npmRebuild: false,
		directories: { output: join(root, "release", version) },
		artifactName: `RiftLegends-${version}.${process.platform === "win32" ? "exe" : "AppImage"}`,
		nsis: {
			oneClick: false,
			perMachine: false,
			allowToChangeInstallationDirectory: true,
			runAfterFinish: false,
		},
		linux: { category: "Game" },
	},
});
