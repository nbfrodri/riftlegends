import { ROLES, type Role, type Side } from "@rift-legends/contracts";
import { edge, MID_GAME } from "../contests/edge";
import { fightChance } from "../contests/fights";
import { pitChance } from "../contests/objectives";
import { MATCH_CONTESTS, playMinute } from "../loop";
import { gameSecond, isAlive } from "../player-state";
import { createMatch, type MatchState } from "../state";
import { ultStatus, windowBoost } from "../ultimates";
import { scenario } from "./scenarios";

/** `state` with the ultimate of `role` of `side` back only after `second`. */
const cooling = (
	state: MatchState,
	side: Side,
	role: Role,
	second: number,
): MatchState => ({
	...state,
	[side]: {
		...state[side],
		players: {
			...state[side].players,
			[role]: { ...state[side].players[role], ultReadyAt: second + 1 },
		},
	},
});

/**
 * Paired probes at the start of every fight minute of real games (K12, K13,
 * plan 08 #339). K12: a side's fight chance with one player's ultimate ready
 * against the same with it on cooldown, apart for engage and wombo carriers.
 * K13: with level sides, how much more often a fight or a pit starts once the
 * rival has spent one ultimate. All in percentage points.
 */
export function ultimateProbes(games: number) {
	const plain: number[] = [];
	const key: number[] = [];
	const fights: number[] = [];
	const pits: number[] = [];
	for (let seed = 0; seed < games; seed++) {
		let state = createMatch(scenario(0, seed, "real"));
		while (state.winner === null && state.minute < 60) {
			state = playMinute(state, MATCH_CONTESTS).state;
			const probe = { ...state, minute: state.minute + 1 };
			if (state.winner !== null || probe.minute < MID_GAME) continue;
			const at = gameSecond(probe.minute, 0);
			const level = windowBoost(probe, at);
			for (const side of ["blue", "red"] as const) {
				const own = (s: MatchState) => {
					const blue = edge(s, "fight", {}, undefined, at).blue;
					return side === "blue" ? blue : 10_000 - blue;
				};
				for (const role of ROLES) {
					if (
						!isAlive(probe, side, role, at) ||
						ultStatus(probe, side, role, at) !== "ready"
					)
						continue;
					const without = cooling(probe, side, role, at);
					const gain = (own(probe) - own(without)) / 100;
					(probe.context[side].ultimates[role].key ? key : plain).push(gain);
					if (level.blue + level.red === 0) {
						// `side` spends it: the window is its rival's.
						fights.push(
							(fightChance(without, at) - fightChance(probe, at)) / 100,
						);
						pits.push((pitChance(without, at) - pitChance(probe, at)) / 100);
					}
				}
			}
		}
	}
	return { plain, key, fights, pits };
}
