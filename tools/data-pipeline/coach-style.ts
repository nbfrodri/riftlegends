import type { RealSnapshot } from "@rift-legends/contracts/real-snapshot";
import type { PERSONALITIES } from "../../packages/contracts/draft/ai.ts";
import { groupBy } from "./normalization.ts";
import { compare } from "./queries.ts";

type Game = RealSnapshot["games"][number];
type Personality = (typeof PERSONALITIES)[number];
type Tag = "early" | "late" | "engage" | "peel" | "carry" | "splitpush";

// TODO(#249): use the real champion archetypes and power curves when available.
// Small offline lookup for recognizable draft signals. Unknown picks add no tag.
const tags: Readonly<Record<string, readonly Tag[]>> = {
	Draven: ["early", "carry"],
	Elise: ["early"],
	Renekton: ["early", "engage"],
	LeeSin: ["early", "engage"],
	Nidalee: ["early"],
	Jayce: ["early", "splitpush"],
	Lucian: ["early", "carry"],
	Kalista: ["early", "carry"],
	Pantheon: ["early", "engage"],
	Azir: ["late", "carry"],
	Jinx: ["late", "carry"],
	Aphelios: ["late", "carry"],
	Zeri: ["late", "carry"],
	Smolder: ["late", "carry"],
	Kaisa: ["late", "carry"],
	Ornn: ["late", "engage"],
	Senna: ["late", "peel"],
	Sivir: ["late", "carry"],
	KogMaw: ["late", "carry"],
	Ryze: ["late", "splitpush"],
	Alistar: ["engage", "peel"],
	Rell: ["engage"],
	Rakan: ["engage", "peel"],
	Leona: ["engage"],
	Nautilus: ["engage"],
	Sejuani: ["engage"],
	Vi: ["engage"],
	JarvanIV: ["engage"],
	Wukong: ["engage"],
	MonkeyKing: ["engage"],
	Gnar: ["engage"],
	Braum: ["peel"],
	Lulu: ["peel"],
	Milio: ["peel"],
	TahmKench: ["peel"],
	Poppy: ["peel"],
	Janna: ["peel"],
	Karma: ["peel"],
	Xayah: ["carry"],
	Fiora: ["splitpush"],
	Camille: ["splitpush"],
	Jax: ["splitpush"],
	Gwen: ["splitpush", "late"],
	Tryndamere: ["splitpush"],
	TwistedFate: ["splitpush"],
};

const minDrafts = 8;
const minLift = 0.06;

export function coachStyles(games: readonly Game[]) {
	const ordered = games.filter((game) => game.draftOrder);
	const lines = games.flatMap((game) => game.lines);
	const playerPools = new Map(
		Array.from(
			groupBy(lines, (line) => line.player),
			([player, rows]) => {
				const picks = groupBy(
					rows.flatMap((row) => row.champion ?? []),
					(id) => id,
				);
				return [
					player,
					[...picks]
						.map(([id, played]) => ({ id, games: played.length }))
						.sort((a, b) => b.games - a.games || compare(a.id, b.id)),
				];
			},
		),
	);
	const pickFrequency = groupBy(
		lines.flatMap((line) => line.champion ?? []),
		(id) => id,
	);
	const rolesByChampion = groupBy(
		lines.filter((line) => line.champion && line.role),
		(line) => line.champion ?? "",
	);
	const flex = new Set(
		Array.from(rolesByChampion).flatMap(([id, rows]) =>
			Array.from(groupBy(rows, (line) => line.role ?? "").values()).filter(
				(role) => role.length >= 2 && role.length * 5 >= rows.length,
			).length >= 2
				? [id]
				: [],
		),
	);

	const evidence = groupBy(
		ordered.flatMap((game) =>
			game.teams.flatMap((side, index) => {
				const first = side.picks[0];
				const rival = game.teams[index === 0 ? 1 : 0];
				if (!first) return [];
				const flags = new Set<Personality>();
				const firstTags = tags[first] ?? [];
				const comp = side.picks.flatMap((id) => (id ? (tags[id] ?? []) : []));
				if (
					firstTags.includes("early") &&
					comp.filter((tag) => tag === "early").length >= 2
				)
					flags.add("early");
				if (
					firstTags.includes("late") &&
					comp.filter((tag) => tag === "late").length >= 2
				)
					flags.add("scaling");
				if (
					comp.includes("splitpush") &&
					(comp.includes("peel") || firstTags.includes("splitpush"))
				)
					flags.add("side-lane");
				if (
					comp.includes("engage") &&
					comp.includes("peel") &&
					comp.includes("carry")
				)
					flags.add("architect");
				if (flex.has(first)) flags.add("flex");

				const frequency = pickFrequency.get(first)?.length ?? 0;
				if (frequency * 5 >= games.length) flags.add("meta");
				const picker = game.lines.find(
					(line) => line.team === side.id && line.champion === first,
				);
				const main = picker && playerPools.get(picker.player)?.[0];
				if (main?.id === first && main.games >= 3) {
					flags.add("comfort");
					if (frequency * 20 <= games.length) flags.add("pocket");
				}

				const bans = new Set(side.bans.slice(0, 3));
				for (const opponent of game.lines.filter(
					(line) => line.team === rival.id,
				)) {
					const pool = playerPools.get(opponent.player) ?? [];
					const best = pool[0];
					if (
						best &&
						best.games >= 3 &&
						best.games >= 2 * (pool[1]?.games ?? 0) &&
						bans.has(best.id)
					)
						flags.add("star-ban");
					if (
						pool
							.slice(0, 3)
							.filter((pick) => pick.games >= 2 && bans.has(pick.id)).length >=
						2
					)
						flags.add("pool-drain");
				}
				return [{ team: side.id, flags }];
			}),
		),
		({ team }) => team,
	);

	// Tie-break favors more specific signals over generic priority picks.
	// TODO(#249): "counterpick" needs real matchup data; any last pick answers
	// the rival's earlier pick, so by itself it cannot tell teams apart.
	const priority: readonly Exclude<Personality, "balanced" | "counterpick">[] =
		[
			"pocket",
			"pool-drain",
			"star-ban",
			"early",
			"scaling",
			"side-lane",
			"architect",
			"flex",
			"meta",
			"comfort",
		];
	// A style is how far a team's rate sits above its league's average rate
	// for that signal, so common signals (everyone drafts "meta" picks) do not win.
	const rated = Array.from(evidence).filter(
		([, drafts]) => drafts.length >= minDrafts,
	);
	const rate = (
		drafts: { flags: Set<Personality> }[],
		personality: Personality,
	) =>
		drafts.filter(({ flags }) => flags.has(personality)).length / drafts.length;
	const average = new Map(
		priority.map((personality) => [
			personality,
			rated.reduce((sum, [, drafts]) => sum + rate(drafts, personality), 0) /
				(rated.length || 1),
		]),
	);
	return (team: string): Personality => {
		const drafts = evidence.get(team) ?? [];
		if (drafts.length < minDrafts) return "balanced";
		let style: Personality = "balanced";
		let highest = minLift;
		for (const personality of priority) {
			const lift = rate(drafts, personality) - (average.get(personality) ?? 0);
			if (lift > highest) {
				style = personality;
				highest = lift;
			}
		}
		return style;
	};
}
