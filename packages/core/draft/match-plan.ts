import type { AiContent, MatchPlan } from "@rift-legends/contracts";
import { SCALE } from "../math";
import { QueryRejection } from "../server/dispatcher";
import { humanTeam } from "./outcome";
import type { SeriesState } from "./series";

function composition(content: AiContent, picks: readonly string[]) {
	const draft = { early: 0, mid: 0, late: 0, engage: 0, poke: 0, splitpush: 0 };
	for (const id of picks) {
		const champion = content.champions.find((entry) => entry.id === id);
		if (!champion) return null;
		draft[champion.power]++;
		const tags = champion.archetypes;
		if (tags.includes("engage") || tags.includes("dive")) draft.engage++;
		if (tags.includes("poke")) draft.poke++;
		if (tags.includes("splitpush")) draft.splitpush++;
	}
	return draft;
}

/** Suggests a game plan from both completed drafts, independently of the series seed. */
export function viewPlan(state: SeriesState): MatchPlan | QueryRejection {
	const { config, draft, content } = state;
	if (state.phase !== "result" || !config || !draft) {
		return new QueryRejection({
			code: "wrong-action",
			params: { expected: "result" },
		});
	}
	const team = humanTeam(config);
	if (team === null) {
		return new QueryRejection({
			code: "invalid-command",
			params: { path: "strategy" },
		});
	}
	const side = team === draft.blue ? "blue" : "red";
	const own = content && composition(content, draft.picks[side]);
	const rival =
		content &&
		composition(content, draft.picks[side === "blue" ? "red" : "blue"]);
	if (!own || !rival) {
		return new QueryRejection({
			code: "invalid-command",
			params: { path: "content" },
		});
	}

	const causes: MatchPlan["causes"] = [];
	const score = (lever: string, factors: Record<string, number>) => {
		let total = 0;
		for (const [key, weight] of Object.entries(factors)) {
			if (weight === 0) continue;
			const points = weight * SCALE;
			causes.push({ key: `${lever}.${key}`, points });
			total += points;
		}
		return total;
	};
	const engage = own.engage - rival.engage;
	const poke = own.poke - rival.poke;
	const tempo = score("tempo", {
		"own.early": 2 * own.early,
		"own.late": -2 * own.late,
		"rival.early": -rival.early,
		"rival.late": rival.late,
	});
	const objectives = score("objectives", {
		early: own.early - rival.early,
		mid: rival.mid - own.mid,
		engage,
		poke: -poke,
		splitpush: 2 * (rival.splitpush - own.splitpush),
	});
	const risk = score("risk", {
		engage,
		poke: -poke,
		late: rival.late - own.late,
	});
	return {
		game: state.game,
		team,
		strategy: {
			tempo: tempo > 0 ? "fast" : tempo < 0 ? "slow" : "balanced",
			objectives:
				objectives > 0 ? "dragon" : objectives < 0 ? "baron" : "balanced",
			risk: risk > 0 ? "risky" : risk < 0 ? "safe" : "balanced",
		},
		causes,
	};
}
