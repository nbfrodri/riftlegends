const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const { join } = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { openWriter } = require("./client.cjs");
const { recovery, crossOS, expectedLog } = require("./checks.cjs");
const { canonicalLog } = require("./core.cjs");
const dl = require("./download.cjs");

const mode = process.env.RIFT76_TEST;
const results = process.env.RIFT76_RESULTS;
if (!app.requestSingleInstanceLock()) app.exit(1);
let writer;
let snap;
app.on("window-all-closed", () => {
	if (!mode) app.quit();
});

async function openDraft() {
	writer = openWriter(join(app.getPath("userData"), "career.sqlite"));
	snap = await writer.request({ op: "start", seed: 2, id: 75 });
	const win = new BrowserWindow({
		title: "Rift Legends",
		width: 900,
		height: 650,
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	win.webContents.on("will-navigate", (e) => e.preventDefault());
	const labels = app.getLocale().toLowerCase().startsWith("es")
		? require("./es.json")
		: require("./en.json");
	ipcMain.handle("draft", async (e, ordinal) => {
		if (e.senderFrame !== win.webContents.mainFrame)
			throw Error("Unexpected frame");
		if (ordinal !== undefined)
			snap = await writer.request({ op: "advance", id: 75, ordinal });
		return {
			ordinal: snap.command,
			facts: snap.facts,
			wins: snap.state.wins,
			labels,
			version: app.getVersion(),
		};
	});
	await win.loadFile(join(__dirname, "index.html"));
	return win;
}

async function smoke() {
	const win = await openDraft();
	const web = win.webContents;
	await web.executeJavaScript("window.ready");
	const before = snap;
	const expected = {
		create: ["0.76.1", 0, 20],
		reopen: ["0.76.1", 20, 20],
		upgrade: ["0.76.2", 20, 60],
	}[mode];
	assert.equal(app.getVersion(), expected[0]);
	assert.equal(before.command, expected[1]);
	assert.equal(before.game_version, "0.76.1");
	if (mode !== "create")
		assert.deepEqual(
			before,
			JSON.parse(fs.readFileSync(join(results, "create.json"))).after,
		);
	for (let ordinal = before.command + 1; ordinal <= expected[2]; ordinal++) {
		const rendered = await web.executeJavaScript(`new Promise(resolve => {
			document.addEventListener("saved", () => resolve(document.body.dataset.ordinal), {once:true});
			document.querySelector("button").click();
		})`);
		assert.equal(Number(rendered), ordinal);
	}
	const log = Buffer.from(canonicalLog(snap.facts));
	const golden = expectedLog(2);
	assert.deepEqual(
		log,
		mode === "upgrade" ? golden : golden.subarray(0, log.length),
	);
	assert.equal(snap.game_version, expected[0]);
	assert.equal(snap.state.game.id, mode === "upgrade" ? 3 : 2);
	assert.equal(snap.facts.at(-1)[0], mode === "upgrade" ? "winner" : "game");
	const after = snap;
	await writer.close();
	win.destroy();
	return { before, after };
}

// Spike 77: play a few draft turns, then (try to) download Data Dragon.
async function downloadMode() {
	const turns = Number(process.env.RIFT77_TURNS ?? 5);
	const manifest = JSON.parse(
		fs.readFileSync(join(__dirname, "manifest.json")),
	);
	const root = join(app.getPath("userData"), "ddragon");
	const win = await openDraft();
	const web = win.webContents;
	await web.executeJavaScript("window.ready");
	const from = snap.command;
	for (let ordinal = from + 1; ordinal <= from + turns; ordinal++) {
		const rendered = await web.executeJavaScript(`new Promise(resolve => {
			document.addEventListener("saved", () => resolve(document.body.dataset.ordinal), {once:true});
			document.querySelector("button").click();
		})`);
		assert.equal(Number(rendered), ordinal);
	}
	const draft = { from, to: snap.command, facts: snap.facts.length };
	await writer.close();
	win.destroy();
	const before = { cache: dl.cacheState(root, manifest), tree: dl.tree(root) };
	const out = { draft, before, userData: app.getPath("userData") };
	if (process.env.RIFT77_ACTION === "verify") {
		return {
			...out,
			after: { cache: dl.cacheState(root, manifest), tree: dl.tree(root) },
		};
	}
	let last = 0;
	try {
		out.download = await dl.download({
			base: process.env.RIFT77_BASE ?? "https://ddragon.leagueoflegends.com",
			manifest,
			root,
			timeoutMs: 10000,
			progress: (file, bytes) => {
				if (bytes - last >= 250000) {
					last = bytes;
					console.error(`DL_PROGRESS ${file} ${bytes}`);
				}
			},
		});
		out.ok = true;
	} catch (error) {
		out.ok = false;
		out.error = `${error.code ?? ""} ${error.message}`.trim();
	}
	out.after = { cache: dl.cacheState(root, manifest), tree: dl.tree(root) };
	return out;
}

app
	.whenReady()
	.then(async () => {
		if (!mode) {
			await openDraft();
			return;
		}
		const timer = setTimeout(() => {
			console.error("Spike timed out:", mode);
			app.exit(2);
		}, 90000);
		assert.ok(app.isPackaged);
		let sample;
		switch (mode) {
			case "recovery":
				sample = await recovery(results);
				break;
			case "dl":
				sample = await downloadMode();
				break;
			case "cross":
				sample = await crossOS(join(results, "cross.sqlite"));
				break;
			default:
				sample = await smoke();
		}
		fs.writeFileSync(
			join(results, `${mode}.json`),
			`${JSON.stringify(
				{
					platform: process.platform,
					arch: process.arch,
					release: os.release(),
					cpu: os.cpus()[0]?.model,
					network: os.networkInterfaces(),
					appVersion: app.getVersion(),
					...(Array.isArray(sample) ? { samples: sample } : sample),
				},
				null,
				2,
			)}\n`,
		);
		clearTimeout(timer);
		app.exit(0);
	})
	.catch((error) => {
		console.error(error);
		app.exit(1);
	});
