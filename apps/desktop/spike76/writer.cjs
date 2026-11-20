const { DatabaseSync } = require("node:sqlite");
const { startSeries, nextTurn, playTurn } = require("./core.cjs");
const { version } = require("./package.json");

const db = new DatabaseSync(process.argv[2]);
db.exec(`
	PRAGMA journal_mode=DELETE;
	PRAGMA synchronous=FULL;
	PRAGMA foreign_keys=ON;
	CREATE TABLE IF NOT EXISTS series (
		id INTEGER PRIMARY KEY, command INTEGER NOT NULL, state TEXT NOT NULL,
		game_version TEXT NOT NULL, content_version TEXT NOT NULL,
		sim_version TEXT NOT NULL, schema_version INTEGER NOT NULL
	) STRICT;
	CREATE TABLE IF NOT EXISTS facts (
		series INTEGER REFERENCES series(id), position INTEGER NOT NULL, fact TEXT NOT NULL,
		PRIMARY KEY(series, position)
	) STRICT;
`);
const select = db.prepare("SELECT * FROM series WHERE id=?");
const history = db.prepare(
	"SELECT position, fact FROM facts WHERE series=? ORDER BY position",
);
const append = db.prepare("INSERT INTO facts VALUES (?, ?, ?)");
const save =
	db.prepare(`INSERT INTO series VALUES (?, ?, ?, ?, 's3-catalog-1', 's3-sim-1', 1)
	ON CONFLICT(id) DO UPDATE SET command=excluded.command, state=excluded.state,
	game_version=excluded.game_version, content_version=excluded.content_version,
	sim_version=excluded.sim_version, schema_version=excluded.schema_version`);

function snapshot(id) {
	const row = select.get(id);
	if (!row) return null;
	const facts = history.all(id).map(({ position, fact }, index) => {
		if (position !== index) throw Error("Non-contiguous fact log");
		return JSON.parse(fact);
	});
	return { ...row, state: JSON.parse(row.state), facts };
}

// The only command is AutoTurn. Its identity is (series, ordinal).
// Both crash hooks stop here with no command reply. The parent terminates the PID.
function write(id, ordinal, series, previousCount, cut) {
	const { facts, ...state } = series;
	db.exec("BEGIN IMMEDIATE");
	try {
		save.run(id, ordinal, JSON.stringify(state), version);
		for (let pos = previousCount; pos < facts.length; pos++)
			append.run(id, pos, JSON.stringify(facts[pos]));
		if (cut === "before") return { atCut: cut };
		db.exec("COMMIT");
		if (cut === "after") return { atCut: cut };
		return { value: snapshot(id) };
	} catch (error) {
		if (db.isTransaction) db.exec("ROLLBACK");
		throw error;
	}
}

function handle({ op, id, seed, ordinal, cut }) {
	if (op === "info")
		return {
			value: {
				driver: "node:sqlite",
				sqlite: db.prepare("SELECT sqlite_version() AS v").get().v,
				node: process.versions.node,
				electron: process.versions.electron,
				processType: process.type,
			},
		};
	if (op === "close") {
		db.close();
		process.exit(0);
	}
	const saved = snapshot(id);
	if (op === "read") return { value: saved };
	if (op === "start") {
		if (saved) {
			if (saved.state.rootSeed !== seed) throw Error("Series seed mismatch");
			return { value: saved };
		}
		return write(id, 0, startSeries(seed, id), 0);
	}
	if (op !== "advance" || !saved) throw Error("Unknown command or series");
	if (
		!Number.isSafeInteger(ordinal) ||
		ordinal < 1 ||
		ordinal > saved.command + 1
	)
		throw Error("Invalid ordinal");
	if (ordinal <= saved.command) return { value: saved };
	const series = { ...saved.state, facts: saved.facts };
	const count = series.facts.length;
	const turn = nextTurn(series);
	if (!turn || playTurn(series, ...turn) !== "accepted")
		throw Error("Illegal turn");
	return write(id, ordinal, series, count, cut);
}
let paused = false;
process.parentPort.on("message", ({ data }) => {
	if (paused) return;
	try {
		const reply = handle(data);
		paused = Boolean(reply.atCut);
		process.parentPort.postMessage(reply);
	} catch (error) {
		process.parentPort.postMessage({ error: String(error) });
	}
});
