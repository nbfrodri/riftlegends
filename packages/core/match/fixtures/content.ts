import { type MatchContent, PLAYER_ATTRIBUTES } from "@rift-legends/contracts";
import { fictionalContent as draft } from "../../ai/fixtures/content";

// What the match simulation reads for the fictional pool of the draft AI
// fixture (plan 08). Plan 10 brings the real content.

type Player = MatchContent["players"][number];
type Attributes = Player["attributes"];
type Champion = MatchContent["champions"][number];

/** Every attribute at `base`, except the ones the player stands out in. */
const rated = (
	base: number,
	standout: Partial<Attributes> = {},
): Attributes => ({
	...(Object.fromEntries(
		PLAYER_ATTRIBUTES.map((key) => [key, base]),
	) as Attributes),
	...standout,
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
		player(
			"forge-top",
			rated(80, { lanes: 88, mechanics: 90, waves: 86, shotcalling: 55 }),
		),
		player(
			"forge-jungle",
			rated(76, { macro: 86, objectiveControl: 90, anticipation: 84 }),
		),
		player(
			"forge-mid",
			rated(92, { experience: 98, composure: 95, roaming: 88 }),
			true,
		),
		player(
			"forge-bot",
			rated(70, {
				farming: 88,
				positioning: 84,
				resilience: 60,
				shotcalling: 40,
			}),
		),
		player(
			"forge-support",
			rated(72, { vision: 90, experience: 90, mechanics: 60, roaming: 82 }),
		),
		player(
			"shoal-top",
			rated(60, { lanes: 74, aggression: 85, experience: 45, focus: 50 }),
		),
		player(
			"shoal-jungle",
			rated(82, { shotcalling: 90, macro: 88, aggression: 78 }),
			true,
		),
		player(
			"shoal-mid",
			rated(74, { mechanics: 88, lanes: 85, consistency: 58, versatility: 50 }),
		),
		player(
			"shoal-bot",
			rated(88, { mechanics: 99, lanes: 98, farming: 96, shotcalling: 45 }),
		),
		player(
			"shoal-support",
			rated(66, { vision: 80, communication: 78, mechanics: 62 }),
		),
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
		blueSide: 30_000,
	},
};
