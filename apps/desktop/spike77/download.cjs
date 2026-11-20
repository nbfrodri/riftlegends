// Spike 77: resumable, verified Data Dragon download. Disposable code.
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const { dirname, join } = require("node:path");

function sha256File(file) {
	const hash = crypto.createHash("sha256");
	const fd = fs.openSync(file, "r");
	const buf = Buffer.alloc(1 << 16);
	try {
		for (;;) {
			const n = fs.readSync(fd, buf, 0, buf.length, null);
			if (n <= 0) break;
			hash.update(buf.subarray(0, n));
		}
	} finally {
		fs.closeSync(fd);
	}
	return hash.digest("hex");
}

function sizeOf(file) {
	try {
		return fs.statSync(file).size;
	} catch {
		return -1;
	}
}

function syncDir(dir) {
	if (process.platform === "win32") return;
	const fd = fs.openSync(dir, "r");
	fs.fsyncSync(fd);
	fs.closeSync(fd);
}

// One HTTP attempt. Appends to `part` from `start`. Resolves with a log entry.
function attempt({ url, part, meta, start, entry, timeoutMs, onProgress }) {
	return new Promise((resolve, reject) => {
		const headers = { "Accept-Encoding": "identity" };
		if (start > 0) {
			headers.Range = `bytes=${start}-`;
			let etag;
			try {
				etag = JSON.parse(fs.readFileSync(meta, "utf8")).etag;
			} catch {}
			if (etag) headers["If-Range"] = etag;
		}
		entry.requestHeaders = {
			range: headers.Range,
			ifRange: headers["If-Range"],
		};
		const lib = url.startsWith("https:") ? https : http;
		const req = lib.get(url, { headers }, (res) => {
			entry.status = res.statusCode;
			entry.acceptRanges = res.headers["accept-ranges"];
			entry.contentRange = res.headers["content-range"];
			entry.etag = res.headers.etag;
			entry.contentLength = res.headers["content-length"];
			if (res.statusCode === 416) {
				res.resume();
				return resolve("range-not-satisfiable");
			}
			let offset = start;
			if (res.statusCode === 206) {
				const m = /^bytes (\d+)-/.exec(res.headers["content-range"] ?? "");
				if (!m || Number(m[1]) !== start) {
					res.resume();
					return reject(Error(`Bad Content-Range: ${entry.contentRange}`));
				}
			} else if (res.statusCode === 200) {
				offset = 0; // server ignored Range: restart this file only
			} else {
				res.resume();
				return reject(Error(`HTTP ${res.statusCode}`));
			}
			entry.servedFrom = offset;
			if (res.headers.etag)
				fs.writeFileSync(meta, JSON.stringify({ etag: res.headers.etag }));
			const fd = fs.openSync(part, offset === 0 ? "w" : "a");
			let received = 0;
			let done = false;
			const finish = (error) => {
				if (done) return;
				done = true;
				fs.closeSync(fd);
				entry.received = received;
				if (error) reject(error);
				else resolve("body-complete");
			};
			res.on("data", (chunk) => {
				fs.writeSync(fd, chunk);
				received += chunk.length;
				onProgress?.(offset + received);
			});
			res.on("end", () => finish());
			res.on("error", (e) => finish(e));
			res.on("close", () => {
				if (!res.complete)
					finish(Error("Connection closed before end of body"));
			});
		});
		req.setTimeout(timeoutMs, () => req.destroy(Error("Request timeout")));
		req.on("error", reject);
	});
}

async function fetchFile({
	base,
	version,
	file,
	staging,
	stats,
	log,
	timeoutMs,
	progress,
}) {
	const final = join(staging, file.path);
	const part = `${final}.part`;
	const meta = `${final}.part.json`;
	fs.mkdirSync(dirname(final), { recursive: true });
	if (sizeOf(final) === file.size && sha256File(final) === file.sha256) {
		stats.kept.push(file.path);
		log.push({ file: file.path, outcome: "kept-verified" });
		return;
	}
	fs.rmSync(final, { force: true });
	const url = `${base}/cdn/${version}/${file.path}`;
	for (let n = 1; n <= 3; n++) {
		let start = sizeOf(part);
		if (start < 0 || start > file.size) {
			fs.rmSync(part, { force: true });
			start = 0;
		}
		const entry = { file: file.path, attempt: n, resumeFrom: start };
		log.push(entry);
		if (start < file.size) {
			try {
				entry.outcome = await attempt({
					url,
					part,
					meta,
					start,
					entry,
					timeoutMs,
					onProgress: (bytes) => progress?.(file.path, bytes),
				});
			} catch (error) {
				entry.outcome = `error: ${error.message}`;
				throw error; // keep .part for the next run
			}
			if (entry.outcome === "range-not-satisfiable") {
				fs.rmSync(part, { force: true });
				stats.restarted.push(file.path);
				continue;
			}
			if (start > 0 && entry.servedFrom === 0) stats.restarted.push(file.path);
			else if (start > 0) stats.resumed.push(file.path);
		}
		if (sizeOf(part) === file.size && sha256File(part) === file.sha256) {
			fs.renameSync(part, final);
			fs.rmSync(meta, { force: true });
			stats.fetchedBytes += entry.received ?? 0;
			entry.verified = true;
			return;
		}
		entry.verified = false;
		entry.outcome += " + hash/size mismatch";
		fs.rmSync(part, { force: true });
		stats.discarded.push(file.path);
	}
	throw Error(`Could not obtain a verified ${file.path}`);
}

function cacheState(root, manifest) {
	const pointer = join(root, "current.json");
	if (!fs.existsSync(pointer)) return { valid: false, reason: "no pointer" };
	let cur;
	try {
		cur = JSON.parse(fs.readFileSync(pointer, "utf8"));
	} catch {
		return { valid: false, reason: "unreadable pointer" };
	}
	if (cur.version !== manifest.version)
		return { valid: false, reason: "other version" };
	const dir = join(root, cur.version);
	for (const f of manifest.files) {
		const p = join(dir, f.path);
		if (sizeOf(p) !== f.size) return { valid: false, reason: `size ${f.path}` };
		if (sha256File(p) !== f.sha256)
			return { valid: false, reason: `hash ${f.path}` };
	}
	return { valid: true, version: cur.version, files: manifest.files.length };
}

async function download({ base, manifest, root, timeoutMs = 10000, progress }) {
	const { version } = manifest;
	const staging = join(root, `staging-${version}`);
	const stats = {
		kept: [],
		resumed: [],
		restarted: [],
		discarded: [],
		fetchedBytes: 0,
	};
	const log = [];
	fs.mkdirSync(staging, { recursive: true });
	for (const file of manifest.files)
		await fetchFile({
			base,
			version,
			file,
			staging,
			stats,
			log,
			timeoutMs,
			progress,
		});
	// Verify everything again before publishing anything.
	for (const f of manifest.files) {
		const p = join(staging, f.path);
		if (sizeOf(p) !== f.size || sha256File(p) !== f.sha256)
			throw Error(`Final verification failed: ${f.path}`);
	}
	const active = join(root, version);
	fs.rmSync(active, { recursive: true, force: true });
	fs.renameSync(staging, active);
	syncDir(root);
	const tmp = join(root, "current.json.tmp");
	const fd = fs.openSync(tmp, "w");
	fs.writeSync(fd, JSON.stringify({ version, files: manifest.files.length }));
	fs.fsyncSync(fd);
	fs.closeSync(fd);
	fs.renameSync(tmp, join(root, "current.json"));
	syncDir(root);
	return { stats, log };
}

function tree(root) {
	const out = [];
	const walk = (dir) => {
		for (const e of fs.existsSync(dir)
			? fs.readdirSync(dir, { withFileTypes: true })
			: []) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else
				out.push({
					path: p
						.slice(root.length + 1)
						.split("\\")
						.join("/"),
					bytes: sizeOf(p),
				});
		}
	};
	walk(root);
	return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

module.exports = { download, cacheState, tree, sha256File };
