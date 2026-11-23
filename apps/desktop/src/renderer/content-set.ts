import type { ContentSet } from "@rift-legends/contracts";

/** Main adds the query only for offline tests and CI captures. */
export function appContent(): ContentSet {
	return new URLSearchParams(window.location.search).get("content") ===
		"fictional"
		? "fictional"
		: "real";
}
