import {
	type AiContent,
	type MatchContent,
	ROLES,
	type Role,
} from "@rift-legends/contracts";
import { indexContent } from "../../ai/content-index";
import { div, type Fixed, fromInt, SCALE } from "../../math";

/** A team's champion in each role. */
export interface Lineup {
	readonly team: string;
	readonly roles: Readonly<Record<Role, string>>;
}

export type Factors = Readonly<Record<string, Fixed>>;

const TIER_POINTS = { "S+": 6, S: 4, A: 2, B: 0, C: -2, D: -4 } as const;
const OFF_ROLE = -6;
const TEMPO = { slow: -3, balanced: 0, fast: 3 } as const;
/** Attributes the profile averages over the team; the rest act in play. */
const AREAS = [
	"lanes",
	"farming",
	"waves",
	"macro",
	"roaming",
	"vision",
	"anticipation",
	"objectiveControl",
	"teamfight",
	"mechanics",
	"positioning",
	"communication",
] as const;

const fixed = (n: number) => (n * SCALE) as Fixed;
/** How far the average of five values is above `mid`, in fixed point (exact). */
const centred = (sum: number, mid = 50) =>
	((sum - 5 * mid) * (SCALE / 5)) as Fixed;

function players(draft: AiContent, match: MatchContent, lineup: Lineup) {
	const roster = indexContent(draft).rosters.get(lineup.team);
	return ROLES.map((role) => {
		const player = roster?.get(role);
		if (!player) throw new Error(`No player for ${lineup.team} in ${role}`);
		const rated = match.players.find((p) => p.id === player.id);
		if (!rated) throw new Error(`No match data for player ${player.id}`);
		return { role, champion: lineup.roles[role], ...rated };
	});
}

function combat(match: MatchContent, ids: readonly string[]) {
	const stats = ids.map((id) => {
		const champion = match.champions.find((c) => c.id === id);
		if (!champion) throw new Error(`No match data for champion ${id}`);
		return champion;
	});
	const total = (key: "frontline" | "cc") =>
		stats.reduce((sum, c) => sum + c[key], 0);
	return { frontline: total("frontline"), cc: total("cc") };
}

function draftFactors(draft: AiContent, us: Lineup, them: Lineup) {
	const { champions, matchups, synergies } = indexContent(draft);
	const ours = ROLES.map((role) => {
		const champion = champions.get(us.roles[role]);
		if (!champion) throw new Error(`Unknown champion ${us.roles[role]}`);
		return { role, champion };
	});
	const meta = ours.reduce((sum, { role, champion }) => {
		const position = champion.positions.find((p) => p.role === role);
		return sum + (position ? TIER_POINTS[position.tier] : OFF_ROLE);
	}, 0);
	let synergy = 0;
	for (let i = 0; i < ours.length; i++) {
		for (let j = i + 1; j < ours.length; j++) {
			const a = ours[i]?.champion.id ?? "";
			synergy += synergies.get(a)?.get(ours[j]?.champion.id ?? "") ?? 0;
		}
	}
	const edge = (a: string, b: string, role: Role) =>
		matchups.get(a)?.get(role)?.get(b) ?? 0;
	const matchup = ROLES.reduce(
		(sum, role) =>
			sum +
			edge(us.roles[role], them.roles[role], role) -
			edge(them.roles[role], us.roles[role], role),
		0,
	);
	const count = (test: (c: (typeof ours)[number]["champion"]) => boolean) =>
		ours.filter(({ champion }) => test(champion)).length;
	const physical = count(
		(c) => c.damage === "physical" || c.damage === "mixed",
	);
	const magic = count((c) => c.damage === "magic" || c.damage === "mixed");
	const peel = count((c) => c.archetypes.includes("peel"));
	return {
		meta: fixed(meta),
		synergy: fixed(synergy),
		matchup: fixed(matchup),
		"power.early": fixed(2 * count((c) => c.power === "early")),
		"power.mid": fixed(2 * count((c) => c.power === "mid")),
		"power.late": fixed(2 * count((c) => c.power === "late")),
		damage: fixed(physical > 0 && magic > 0 ? 4 : -4),
		peel: fixed(2 * (peel < 2 ? peel : 2)),
	};
}

/** Every input of a team's profile, centred near zero, in fixed point. */
export function teamFactors(
	draft: AiContent,
	match: MatchContent,
	us: Lineup,
	them: Lineup,
): Factors {
	const roster = players(draft, match, us);
	const team = match.teams.find((t) => t.id === us.team);
	if (!team) throw new Error(`No match data for team ${us.team}`);

	const area: Record<string, Fixed> = {};
	for (const key of AREAS) {
		area[key] = centred(roster.reduce((sum, p) => sum + p.attributes[key], 0));
	}
	const jungler = roster[ROLES.indexOf("jungle")]?.attributes ?? {
		macro: 0,
		mechanics: 0,
	};
	const mastery = roster.reduce(
		(sum, p) =>
			sum +
			// A champion the player has never shown: versatility softens it.
			(p.mastery.find((m) => m.champion === p.champion)?.value ??
				p.attributes.versatility / 2),
		0,
	);
	const { frontline, cc } = combat(match, Object.values(us.roles));
	const pairs = team.chemistry;
	const chemistry =
		pairs.length === 0
			? fixed(0)
			: div(
					fromInt(pairs.reduce((sum, p) => sum + p.value - 50, 0)),
					fromInt(pairs.length),
				);
	const tempo = TEMPO[team.strategy.tempo];
	return {
		...area,
		/** The jungler's macro and mechanics, averaged and centred on 50. */
		jungler: ((jungler.macro + jungler.mechanics - 100) * (SCALE / 2)) as Fixed,
		mastery: centred(mastery),
		...draftFactors(draft, us, them),
		frontline: centred(frontline, 4),
		cc: centred(cc, 4),
		chemistry,
		"tempo.early": fixed(tempo),
		"tempo.late": fixed(-tempo),
	};
}
