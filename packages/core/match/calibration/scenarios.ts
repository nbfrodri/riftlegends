import {
	type MatchContent,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { indexContent } from "../../ai/content-index";
import { packagedDraftContent, packagedMatchContent } from "../../content";
import { loadRealContent } from "../../content/real";
import { clamp } from "../../math/int";
import { shuffle } from "../../rng/helpers";
import { SCOPES } from "../../rng/scopes";
import { deriveSeed } from "../../rng/seeds";
import { createRng } from "../../rng/streams";
import { syntheticContent } from "../../test/synthetic-content";
import { MATCH_CONTESTS, matchDuration, playMatch } from "../loop";
import { mentalEdge } from "../mental";
import type { MatchSetup } from "../state";
import { playerStats } from "../stats";
import { structureTakes } from "./takes";

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
type Pool = "control" | "packaged" | "real-champions" | "real";
const primaryPools = (draft: typeof packagedDraftContent) =>
	ROLES.map((role) =>
		draft.champions
			.filter((champion) => champion.positions[0]?.role === role)
			.map((champion) => champion.id),
	);

const opening = {
	game: 1,
	decisive: false,
	stage: "regular",
	results: [],
} as const;

function setup(
	seed: number,
	draft: MatchSetup["draft"],
	match: MatchContent,
	blue: MatchSetup["blue"],
	red: MatchSetup["red"],
): MatchSetup {
	return {
		seed,
		game: 1,
		draft,
		match,
		blue,
		red,
		mental: {
			blue: mentalEdge(draft, match, blue, "blue", opening),
			red: mentalEdge(draft, match, red, "red", opening),
		},
	};
}

function realScenario(edge: number, seed: number): MatchSetup {
	const { draft, match } = loadRealContent();
	const { rosters } = indexContent(draft);
	const teams = match.teams.filter(
		({ id }) => rosters.get(id)?.size === ROLES.length,
	);
	// Play each pairing in both side assignments, with distinct match streams.
	const side = seed % 2;
	const rng = createRng(deriveSeed((seed - side) / 2, SCOPES.draft));
	const [first, second] = shuffle(rng, teams);
	if (!first || !second) throw new Error("Real calibration needs two rosters");
	const pairs = primaryPools(draft).map((choices) => shuffle(rng, choices));
	const lineups = [
		lineup(
			first.id,
			pairs.map(([champion]) => champion),
		),
		lineup(
			second.id,
			pairs.map(([, champion]) => champion),
		),
	] as const;
	const blue = lineups[side === 0 ? 0 : 1];
	const red = lineups[side === 0 ? 1 : 0];
	const boostedIds = new Set(
		Array.from(rosters.get(blue.team)?.values() ?? [], ({ id }) => id),
	);
	const boosted =
		edge === 0
			? match
			: {
					...match,
					players: match.players.map((player) =>
						boostedIds.has(player.id)
							? {
									...player,
									attributes: Object.fromEntries(
										Object.entries(player.attributes).map(([key, value]) => [
											key,
											clamp(value + edge, 0, 100),
										]),
									) as typeof player.attributes,
								}
							: player,
					),
				};
	return setup(seed, draft, boosted, blue, red);
}

/** With an edge, add attribute points to the blue lineup. */
export function scenario(edge: number, seed: number, pool: Pool): MatchSetup {
	if (pool === "real") return realScenario(edge, seed);
	const { draft: control, match } = syntheticContent(POOL, ["a", "b"]);
	const packaged = pool !== "control";
	const source =
		pool === "real-champions"
			? loadRealContent()
			: { draft: packagedDraftContent, match: packagedMatchContent };
	// Hold player strength and team strategy constant while sampling the real
	// champion profiles, matchups and synergies across both sides.
	const draft = packaged
		? {
				...source.draft,
				players: control.players.map((player) => ({ ...player, mains: [] })),
			}
		: control;
	const boosted: MatchContent = {
		...match,
		champions: packaged ? source.match.champions : match.champions,
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
		? primaryPools(source.draft).map((choices) =>
				shuffle(rng, choices).slice(0, 2),
			)
		: ROLES.map((_, i) => [POOL[i], POOL[i + ROLES.length]]);
	const blue = lineup(
		"a",
		pairs.map(([first]) => first),
	);
	const red = lineup(
		"b",
		pairs.map(([, second]) => second),
	);
	return setup(seed, draft, boosted, blue, red);
}

/** Many games of a scenario, with what the calibration bands read. */
export function sample(games: number, edge: number, pool: Pool) {
	return Array.from({ length: games }, (_, seed) => {
		const setup = scenario(edge, seed, pool);
		const { state, events } = playMatch(setup, MATCH_CONTESTS);
		const at20 = { blue: 0, red: 0 };
		for (const e of events) {
			if (e.minute <= 20)
				for (const s of ["blue", "red"] as const) at20[s] += e.gold[s];
		}
		const stats = playerStats(
			events.map((e, i) => ({ ...e, position: i + 1 })),
			{
				blue: { ...state.context.blue, champions: setup.blue.roles },
				red: { ...state.context.red, champions: setup.red.roles },
			},
			state.context.rules,
			matchDuration(events.at(-1)),
		);
		const teams = (["blue", "red"] as const).map((side) => {
			const roleOf = new Map(
				ROLES.map((role) => [state.context[side].players[role], role]),
			);
			const line = Object.fromEntries(
				ROLES.map((role) => [
					role,
					{
						kills: 0,
						assists: 0,
						goldShare: 0,
						damageShare: 0,
						rating: 0,
						vision: 0,
					},
				]),
			) as Record<
				Role,
				{
					kills: number;
					assists: number;
					goldShare: number;
					damageShare: number;
					rating: number;
					/** Vision score per 30 minutes. */
					vision: number;
				}
			>;
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
			// Gold and damage by role, as a share of the team (plan 08, K7).
			const teamStats = stats.filter(
				(p) => p.team === state.context[side].team,
			);
			const gold = teamStats.reduce((sum, p) => sum + p.gold, 0);
			const damage = teamStats.reduce((sum, p) => sum + p.damage, 0);
			for (const role of ROLES) {
				const mine = teamStats.find(
					(p) => p.player === state.context[side].players[role],
				);
				if (!mine) throw new Error(`Missing calibration stats for ${role}`);
				line[role].goldShare = (mine.gold / gold) * 100;
				line[role].damageShare = (mine.damage / damage) * 100;
				line[role].rating = mine.rating;
				line[role].vision = (mine.vision * 1800) / matchDuration(events.at(-1));
			}
			return { kills, line };
		});
		const roleOfPlayer = new Map(
			(["blue", "red"] as const).flatMap((side) =>
				ROLES.map((role) => [state.context[side].players[role], role] as const),
			),
		);
		const streaks = events.flatMap((e) =>
			e.kills.flatMap(({ killer, multikill }) => {
				const role = roleOfPlayer.get(killer);
				return role && multikill ? [{ role, count: multikill }] : [];
			}),
		);
		const allKills = events.flatMap((e) => e.kills);
		const firstKill = events.find((e) => e.kills.length > 0);
		const opening = allKills.find((k) => k.firstBlood);
		const objectives = events.filter((e) => e.steal);
		/** Seconds each victim stays down (K22, plan 08 #528). */
		const deaths = events.flatMap((e) =>
			e.kills.flatMap((k) =>
				k.respawnAt === undefined
					? []
					: [
							k.respawnAt -
								((e.minute - 1) * 60 + e.second + (k.fightSecond ?? 0)),
						],
			),
		);
		const takes = structureTakes(state, events);
		return {
			takes,
			deaths,
			streaks,
			plays: {
				/** Minute of the opening kill, and whether it had assistants. */
				firstBloodMinute: firstKill?.minute ?? null,
				firstBloodAssisted: (opening?.assists.length ?? 0) > 0,
				soloKills: allKills.filter((k) => k.soloKill).length,
				shutdowns: allKills.filter((k) => k.shutdown).length,
				shutdownGold: allKills.reduce((sum, k) => sum + (k.shutdown ?? 0), 0),
				aces: allKills.filter((k) => k.ace).length,
				topSpree: allKills.reduce(
					(top, k) => ((k.spree ?? 0) > top ? (k.spree ?? 0) : top),
					0,
				),
				steals: objectives.length,
			},
			teams,
			winner: state.winner as Side,
			minutes: state.minute,
			kills: state.blue.kills + state.red.kills,
			towers: events.filter((event) => event.kind === "tower").length,
			dragons: state.blue.dragons + state.red.dragons,
			goldAt20: at20,
			finalGold: { blue: state.blue.gold, red: state.red.gold },
		};
	});
}
