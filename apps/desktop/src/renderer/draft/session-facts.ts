import { useCallback, useState } from "react";

/** Format and fearless mode of the series, from its `series.started` fact. */
export interface SeriesRules {
	format: "bo1" | "bo3" | "bo5";
	fearless: "hard" | "soft" | "off";
}

/** The last ban or pick the core accepted. */
export interface DraftLock {
	game: number;
	position: number;
	team: string;
	champion: string | null;
	action: "ban" | "pick";
}

/** A fact the core returned, as far as this hook reads it. */
interface Fact {
	type: string;
	position: number;
	[key: string]: unknown;
}

/** Series state the UI derives from the facts that come back with each command. */
export function useSeriesFacts() {
	const [timer, setTimer] = useState(false);
	const [rules, setRules] = useState<SeriesRules | null>(null);
	const [sideChoosers, setSideChoosers] = useState<Record<number, string>>({});
	const [lock, setLock] = useState<DraftLock | null>(null);

	const applyFacts = useCallback((facts: readonly Fact[]) => {
		for (const fact of facts) {
			if (
				fact.type === "side.chosen" &&
				fact.kind === "side" &&
				typeof fact.game === "number" &&
				typeof fact.team === "string"
			) {
				const { game, team } = fact;
				setSideChoosers((previous) => ({ ...previous, [game]: team }));
			}
			if (fact.type === "series.started") {
				setTimer(fact.timer === true);
				setRules({
					format: fact.format as SeriesRules["format"],
					fearless: fact.fearless as SeriesRules["fearless"],
				});
			}
			if (
				(fact.type === "draft.banned" || fact.type === "draft.picked") &&
				typeof fact.game === "number" &&
				typeof fact.team === "string" &&
				(typeof fact.champion === "string" || fact.champion === null)
			) {
				setLock({
					game: fact.game,
					position: fact.position,
					team: fact.team,
					champion: fact.champion,
					action: fact.type === "draft.banned" ? "ban" : "pick",
				});
			}
		}
	}, []);

	return { timer, rules, sideChoosers, lock, applyFacts };
}
