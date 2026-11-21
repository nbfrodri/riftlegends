import type { MatchContent } from "@rift-legends/contracts";
import { fictionalContent as draft } from "../../ai/fixtures/content";

// What the match simulation reads for the fictional pool of the draft AI
// fixture (plan 08). Plan 10 brings the real content.

type Player = MatchContent["players"][number];
type Attributes = Player["attributes"];
type Champion = MatchContent["champions"][number];

/** Attributes in the order of `Attributes`, to keep each row short. */
const attributes = (
	...[
		lanes,
		teamfight,
		macro,
		mechanics,
		composure,
		resilience,
		experience,
		consistency,
		shotcalling,
	]: number[]
): Attributes => ({
	lanes: lanes ?? 0,
	teamfight: teamfight ?? 0,
	macro: macro ?? 0,
	mechanics: mechanics ?? 0,
	composure: composure ?? 0,
	resilience: resilience ?? 0,
	experience: experience ?? 0,
	consistency: consistency ?? 0,
	shotcalling: shotcalling ?? 0,
});

const MASTERY = { mains: 90, secondary: 70, weak: 35 } as const;

const player = (id: string, values: Attributes, leader = false): Player => {
	const pools = draft.players.find((p) => p.id === id);
	if (!pools) throw new Error(`No draft player ${id}`);
	const mastery = (["mains", "secondary", "weak"] as const).flatMap((pool) =>
		pools[pool].map((champion) => ({ champion, value: MASTERY[pool] })),
	);
	return { id, attributes: values, leader, mastery };
};

/** Combat profile by archetype; a champion takes the highest of each. */
const ARCHETYPE_STATS: Record<string, Omit<Champion, "id">> = {
	tank: { cc: 6, mobility: 2, frontline: 9 },
	engage: { cc: 8, mobility: 5, frontline: 6 },
	peel: { cc: 6, mobility: 3, frontline: 3 },
	poke: { cc: 2, mobility: 3, frontline: 1 },
	dive: { cc: 4, mobility: 8, frontline: 4 },
	pick: { cc: 7, mobility: 5, frontline: 1 },
	carry: { cc: 1, mobility: 4, frontline: 1 },
	hypercarry: { cc: 1, mobility: 3, frontline: 0 },
	splitpush: { cc: 2, mobility: 6, frontline: 4 },
	skirmish: { cc: 3, mobility: 7, frontline: 3 },
	utility: { cc: 5, mobility: 3, frontline: 2 },
};

const champion = ({
	id,
	archetypes,
}: (typeof draft.champions)[number]): Champion => {
	const stats = archetypes.map((a) => ARCHETYPE_STATS[a]);
	const best = (key: keyof Omit<Champion, "id">) =>
		stats.reduce(
			(top, s) => ((s?.[key] ?? 0) > top ? (s?.[key] ?? 0) : top),
			0,
		);
	return {
		id,
		cc: best("cc"),
		mobility: best("mobility"),
		frontline: best("frontline"),
	};
};

export const fictionalMatchContent: MatchContent = {
	players: [
		// lanes, teamfight, macro, mechanics, composure, resilience,
		// experience, consistency, shotcalling
		player("forge-top", attributes(88, 84, 80, 90, 75, 70, 85, 80, 55)),
		player("forge-jungle", attributes(70, 80, 86, 78, 82, 76, 72, 74, 72)),
		player("forge-mid", attributes(92, 90, 94, 93, 95, 92, 98, 90, 88), true),
		player("forge-bot", attributes(80, 82, 70, 84, 66, 60, 64, 62, 40)),
		player("forge-support", attributes(62, 72, 74, 60, 70, 80, 90, 85, 76)),
		player("shoal-top", attributes(74, 66, 62, 76, 58, 55, 45, 60, 35)),
		player(
			"shoal-jungle",
			attributes(78, 86, 88, 82, 80, 84, 80, 82, 90),
			true,
		),
		player("shoal-mid", attributes(85, 80, 76, 88, 72, 64, 60, 58, 50)),
		player("shoal-bot", attributes(98, 96, 82, 99, 85, 78, 70, 92, 45)),
		player("shoal-support", attributes(58, 70, 66, 62, 64, 72, 75, 70, 68)),
	],
	teams: [
		{
			id: "forge",
			chemistry: [
				{ a: "forge-mid", b: "forge-jungle", value: 85 },
				{ a: "forge-bot", b: "forge-support", value: 60 },
				{ a: "forge-top", b: "forge-jungle", value: 70 },
			],
			strategy: { tempo: "balanced", objectives: "baron", risk: "safe" },
			adaptation: 80,
		},
		{
			id: "shoal",
			chemistry: [
				{ a: "shoal-bot", b: "shoal-support", value: 90 },
				{ a: "shoal-jungle", b: "shoal-mid", value: 55 },
				{ a: "shoal-top", b: "shoal-jungle", value: 45 },
			],
			strategy: { tempo: "fast", objectives: "dragon", risk: "risky" },
			adaptation: 55,
		},
	],
	champions: draft.champions.map(champion),
	rules: {
		objectives: {
			dragon: { first: 300, respawn: 300 },
			herald: { first: 840, respawn: 360 },
			baron: { first: 1200, respawn: 360 },
			elder: { first: 2100, respawn: 360 },
		},
		inhibitorRespawn: 300,
		economy: {
			passive: 2000,
			kill: 300,
			assist: 150,
			tower: 550,
			inhibitor: 50,
			dragon: 200,
			herald: 300,
			baron: 1500,
			elder: 250,
		},
		goldWeight: [
			{ minute: 0, weight: 10000 },
			{ minute: 15, weight: 8500 },
			{ minute: 25, weight: 7000 },
			{ minute: 35, weight: 5500 },
		],
		blueSide: 200,
	},
};
