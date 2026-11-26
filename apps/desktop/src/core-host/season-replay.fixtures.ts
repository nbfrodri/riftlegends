import { createHash } from "node:crypto";
import { loadRealContent } from "@rift-legends/core";
import cblol from "../../../../packages/core/content/real/formats/cblol.json";
import firstStand from "../../../../packages/core/content/real/formats/first-stand.json";
import lck from "../../../../packages/core/content/real/formats/lck.json";
import lcp from "../../../../packages/core/content/real/formats/lcp.json";
import lcs from "../../../../packages/core/content/real/formats/lcs.json";
import lec from "../../../../packages/core/content/real/formats/lec.json";
import lpl from "../../../../packages/core/content/real/formats/lpl.json";
import msi from "../../../../packages/core/content/real/formats/msi.json";
import worlds from "../../../../packages/core/content/real/formats/worlds.json";
import { accepted, client } from "./season.fixtures";

/** The real exhibition season (six leagues and three international events). */
export function realSeason(seed: number) {
	const { match, season } = loadRealContent();
	return {
		year: season,
		seed,
		competitions: [lck, lpl, lec, lcp, lcs, cblol, firstStand, msi, worlds],
		teams: match.teams.flatMap(({ id, league, seed: rank }) =>
			league ? [{ id, competition: league, region: league, rank }] : [],
		),
	};
}

/** Plays `days` match days (all when omitted) and hashes every fact of the log. */
export function replayDigest(
	body: object,
	days = Number.POSITIVE_INFINITY,
	onDay?: (ms: number) => void,
	/** Plays each day this many series at a time; `onBatch` times each call. */
	batch?: { size: number; onBatch?: (ms: number) => void },
) {
	const core = client();
	const hash = createHash("sha256");
	hash.update(JSON.stringify(accepted(core.send("season.create", body)).facts));
	const overview = () => {
		const result = core.query("season.overview", {});
		if (!result.ok || !("view" in result)) throw new Error("overview");
		return (result.view as { day: number | null }).day;
	};
	let played = 0;
	for (let day = overview(); day !== null && played < days; day = overview()) {
		const started = performance.now();
		const facts: unknown[] = [];
		do {
			const from = performance.now();
			const result = accepted(
				core.send("season.playDay", { day, maxSeries: batch?.size }),
			);
			batch?.onBatch?.(performance.now() - from);
			facts.push(...result.facts);
		} while (batch && overview() === day);
		onDay?.(performance.now() - started);
		hash.update(JSON.stringify(facts));
		played++;
	}
	return { played, digest: hash.digest("hex") };
}
