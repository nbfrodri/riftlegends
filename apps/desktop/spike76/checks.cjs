const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { openWriter } = require("./client.cjs");
const { canonicalLog } = require("./core.cjs");
const bytes = (value) => Buffer.from(JSON.stringify(value));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const done = (snap) => snap.facts.at(-1)[0] === "winner";

async function advance(writer, snap) {
	return writer.request({
		op: "advance",
		id: snap.id,
		ordinal: snap.command + 1,
	});
}
async function finish(writer, snap) {
	while (!done(snap)) snap = await advance(writer, snap);
	return snap;
}
function expectedLog(seed) {
	return readFileSync(join(__dirname, `${seed}.golden`));
}
function proveSnapshot(actual, expected) {
	assert.deepEqual(bytes(actual.state), bytes(expected.state));
	assert.deepEqual(
		bytes(actual.state.game.rng),
		bytes(expected.state.game.rng),
	);
	assert.deepEqual(
		Buffer.from(canonicalLog(actual.facts)),
		Buffer.from(canonicalLog(expected.facts)),
	);
	assert.deepEqual(bytes(actual), bytes(expected));
}

async function recovery(dir) {
	const samples = [];
	for (const seed of [0, 2, 4294967295]) {
		let baseline;
		let before;
		let after;
		for (const cut of ["none", "before", "after"]) {
			const file = join(dir, `${seed}-${cut}.sqlite`);
			let writer = openWriter(file);
			try {
				const driver = await writer.request({ op: "info" });
				assert.equal(driver.processType, "utility");
				assert.equal(await writer.request({ op: "read", id: 75 }), null);
				let snap = await writer.request({ op: "start", seed, id: 75 });
				while (snap.command < 19) snap = await advance(writer, snap);
				const command = { op: "advance", id: 75, ordinal: 20 };
				let killed, reopened;
				if (cut === "none") {
					before = snap;
					snap = await writer.request(command);
					after = snap;
				} else {
					killed = await writer.request({ ...command, cut });
					assert.equal(killed.atCut, cut);
					await writer.close();
					writer = openWriter(file);
					reopened = await writer.request({ op: "read", id: 75 });
					proveSnapshot(reopened, cut === "before" ? before : after);
					snap = await writer.request(command);
					proveSnapshot(snap, after);
				}
				const end = await finish(writer, snap);
				const log = Buffer.from(canonicalLog(end.facts));
				assert.deepEqual(log, expectedLog(seed));
				if (baseline) proveSnapshot(end, baseline);
				else baseline = end;
				samples.push({
					seed,
					cut,
					...driver,
					killed,
					reopenedCommand: reopened?.command,
					reopenedFacts: reopened?.facts.length,
					command: end.command,
					facts: end.facts.length,
					stateSHA256: sha(bytes(end.state)),
					rng: end.state.game.rng,
					logBytes: log.length,
					logSHA256: sha(log),
				});
			} finally {
				await writer.close();
			}
		}
	}
	return samples;
}

async function crossOS(file) {
	const writer = openWriter(file);
	try {
		const original = await writer.request({ op: "read", id: 75 });
		assert.equal(original.state.rootSeed, 2);
		assert.equal(original.game_version, "0.76.1");
		assert.equal(original.command, 60);
		assert.deepEqual(Buffer.from(canonicalLog(original.facts)), expectedLog(2));
		assert.equal(await writer.request({ op: "read", id: 76 }), null);
		const next = await writer.request({
			op: "start",
			id: 76,
			seed: original.state.rootSeed,
		});
		const end = await finish(writer, next);
		assert.equal(done(end), true);
		proveSnapshot(await writer.request({ op: "read", id: 75 }), original);
		return {
			originalSeries: 75,
			originalFacts: original.facts.length,
			nextSeries: 76,
			nextFacts: end.facts.length,
			game_version: end.game_version,
		};
	} finally {
		await writer.close();
	}
}
module.exports = { recovery, crossOS, expectedLog };
