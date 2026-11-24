import {
	type MatchContent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { packagedDraftContent, packagedMatchContent } from "../../content";
import { shuffle } from "../../rng/helpers";
import { SCOPES } from "../../rng/scopes";
import { deriveSeed } from "../../rng/seeds";
import { createRng } from "../../rng/streams";
import { syntheticContent } from "../../test/synthetic-content";
import { MATCH_CONTESTS, playMatch } from "../loop";
import { mentalEdge } from "../mental";
import type { MatchSetup } from "../state";

const POOL = Array.from({ length: 10 }, (_, i) => `c${i}`);
const lineup = (team: string, champions: readonly (string | undefined)[]) => ({
	team,
	roles: Object.fromEntries(
		ROLES.map((role, i) => {
			const champion = champions[i];
			if (!champion)
				throw new Error(`Missing calibration champion for ${role}`);
			return [role, champion];
		}),
	) as MatchSetup["blue"]["roles"],
});
const primaryPools = ROLES.map((role) =>
	packagedDraftContent.champions
		.filter((champion) => champion.positions[0]?.role === role)
		.map((champion) => champion.id),
);

/** Two average teams; `edge` adds to every attribute of team "a". */
function scenario(
	edge: number,
	seed: number,
	pool: "control" | "packaged",
): MatchSetup {
	const { draft: control, match } = syntheticContent(POOL, ["a", "b"]);
	const packaged = pool === "packaged";
	// Hold player strength and team strategy constant while sampling the real
	// champion profiles, matchups and synergies across both sides.
	const draft = packaged
		? {
				...packagedDraftContent,
				players: control.players.map((player) => ({ ...player, mains: [] })),
			}
		: control;
	const boosted: MatchContent = {
		...match,
		champions: packaged ? packagedMatchContent.champions : match.champions,
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
	const rng = createRng(deriveSeed(seed, SCOPES.draft));
	const pairs = packaged
		? primaryPools.map((choices) => shuffle(rng, choices).slice(0, 2))
		: ROLES.map((_, i) => [POOL[i], POOL[i + ROLES.length]]);
	const blue = lineup(
		"a",
		pairs.map(([first]) => first),
	);
	const red = lineup(
		"b",
		pairs.map(([, second]) => second),
	);
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
export function sample(
	games: number,
	edge: number,
	pool: "control" | "packaged",
) {
	return Array.from({ length: games }, (_, seed) => {
		const setup = scenario(edge, seed, pool);
		const { state, events } = playMatch(setup, MATCH_CONTESTS);
		const at20 = { blue: 0, red: 0 };
		for (const e of events) {
			if (e.minute <= 20)
				for (const s of ["blue", "red"] as const) at20[s] += e.gold[s];
		}
		const teams = (["blue", "red"] as const).map((side) => {
			const roleOf = new Map(
				ROLES.map((role) => [state.context[side].players[role], role]),
			);
			const line = Object.fromEntries(
				ROLES.map((role) => [role, { kills: 0, assists: 0 }]),
			) as Record<Role, { kills: number; assists: number }>;
			let kills = 0;
			for (const k of events.flatMap((e) => e.kills)) {
				const killer = roleOf.get(k.killer);
				if (!killer) continue;
				kills++;
				line[killer].kills++;
				for (const id of k.assists) {
					const helper = roleOf.get(id);
					if (helper) line[helper].assists++;
				}
			}
			return { kills, line };
		});
		return {
			teams,
			winner: state.winner as Side,
			minutes: state.minute,
			kills: state.blue.kills + state.red.kills,
			goldAt20: at20,
		};
	});
}
