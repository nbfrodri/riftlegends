// Usage: node summarize.mjs <run-dir> <out-prefix>  -> <prefix>.json and <prefix>.csv
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [run, prefix] = process.argv.slice(2);
const rows = [];
const samples = {};
for (const sc of readdirSync(run)
	.filter((n) => /^S\d/.test(n))
	.sort()) {
	const res = join(run, sc, "results");
	samples[sc] = {};
	for (const step of readdirSync(res).filter(
		(n) => /^\d/.test(n) && !n.includes("."),
	)) {
		const f = join(res, step, "dl.json");
		const killed = existsSync(join(res, step, "killed.txt"))
			? readFileSync(join(res, step, "killed.txt"), "utf8").trim()
			: undefined;
		if (!existsSync(f)) {
			samples[sc][step] = { killed };
			rows.push([sc, step, "killed", killed, "", "", "", "", "", ""]);
			continue;
		}
		const j = JSON.parse(readFileSync(f));
		const ifaces = Object.entries(j.network).map(
			([n, a]) => `${n}:${a.length}`,
		);
		const parts = j.after.tree.filter((t) => t.path.endsWith(".part"));
		samples[sc][step] = {
			ok: j.ok,
			error: j.error,
			draft: j.draft,
			cacheBefore: j.before.cache,
			cacheAfter: j.after.cache,
			interfaces: ifaces,
			tree: j.after.tree,
			stats: j.download?.stats,
			requests: j.download?.log,
		};
		rows.push([
			sc,
			step,
			j.ok ?? "verify",
			j.error ?? "",
			`${j.draft.from}->${j.draft.to}`,
			j.after.cache.valid,
			j.after.cache.reason ?? "",
			parts.map((p) => `${p.path}=${p.bytes}`).join(" "),
			j.download
				? `kept=${j.download.stats.kept.length} resumed=${j.download.stats.resumed.length} restarted=${j.download.stats.restarted.length} discarded=${j.download.stats.discarded.length} fetched=${j.download.stats.fetchedBytes}`
				: "",
			ifaces.join(" "),
		]);
	}
	for (const f of ["ref.sha", "cache.sha"])
		samples[sc][f] = readFileSync(join(res, f), "utf8").trim().split("\n");
	samples[sc].identicalToReference =
		JSON.stringify(samples[sc]["ref.sha"]) ===
		JSON.stringify(samples[sc]["cache.sha"]);
	for (const f of readdirSync(res).filter(
		(n) => n.startsWith("snapshot-") || n.startsWith("proxy-"),
	))
		samples[sc][f] = readFileSync(join(res, f), "utf8").trim().split("\n");
}
const head =
	"scenario,step,ok,error,draft_ordinal,cache_valid,cache_reason,partial_files,download_stats,interfaces_with_address";
writeFileSync(
	`${prefix}.csv`,
	`${[head, ...rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', "'")}"`).join(","))].join("\n")}\n`,
);
writeFileSync(`${prefix}.json`, `${JSON.stringify(samples, null, 1)}\n`);
