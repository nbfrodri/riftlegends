import type { MatchContent, Side } from "@rift-legends/contracts";
import { syntheticContent } from "../../test/synthetic-content";
import { MATCH_CONTESTS, playMatch } from "../loop";
import { mentalEdge } from "../mental";
import type { MatchSetup } from "../state";

const POOL = Array.from({ length: 10 }, (_, i) => `c${i}`);
const ROLES = ["top", "jungle", "mid", "bot", "support"] as const;
const lineup = (team: string, offset: number) => ({
	team,
	roles: Object.fromEntries(
		ROLES.map((role, i) => [role, POOL[offset + i] ?? ""]),
	) as MatchSetup["blue"]["roles"],
});

/** Two average teams; `edge` adds to every attribute of team "a". */
function scenario(edge = 0, seed = 0): MatchSetup {
	const { draft, match } = syntheticContent(POOL, ["a", "b"]);
	const boosted: MatchContent = {
		...match,
		players: match.players.map((p) =>
			p.id.startsWith("a-")
				? {
						...p,
						attributes: Object.fromEntries(
							Object.entries(p.attributes).map(([k, v]) => [k, v + edge]),
						) as typeof p.attributes,
					}
				: p,
		),
	};
	const blue = lineup("a", 0);
	const red = lineup("b", 5);
	const opening = {
		game: 1,
		decisive: false,
		stage: "regular",
		results: [],
	} as const;
	return {
		seed,
		game: 1,
		draft,
		match: boosted,
		blue,
		red,
		mental: {
			blue: mentalEdge(draft, boosted, blue, "blue", opening),
			red: mentalEdge(draft, boosted, red, "red", opening),
		},
	};
}

/** Many games of a scenario, with what the calibration bands read. */
export function sample(games: number, edge = 0) {
	return Array.from({ length: games }, (_, seed) => {
		const setup = scenario(edge, seed);
		const { state, events } = playMatch(setup, MATCH_CONTESTS);
		const at20 = { blue: 0, red: 0 };
		for (const e of events) {
			if (e.minute <= 20)
				for (const s of ["blue", "red"] as const) at20[s] += e.gold[s];
		}
		return {
			winner: state.winner as Side,
			minutes: state.minute,
			kills: state.blue.kills + state.red.kills,
			goldAt20: at20,
		};
	});
}
