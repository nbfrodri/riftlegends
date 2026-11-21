import type { AiContent, Role } from "@rift-legends/contracts";

type Champion = AiContent["champions"][number];
type Position = Champion["positions"][number];

const position = (role: Role, tier: Position["tier"]): Position => ({
	role,
	tier,
});
function champion(
	id: string,
	positions: Position[],
	damage: Champion["damage"],
	power: Champion["power"],
	...archetypes: Champion["archetypes"]
): Champion {
	return { id, positions, damage, power, archetypes };
}

const top = (tier: Position["tier"]) => position("top", tier);
const jungle = (tier: Position["tier"]) => position("jungle", tier);
const mid = (tier: Position["tier"]) => position("mid", tier);
const bot = (tier: Position["tier"]) => position("bot", tier);
const support = (tier: Position["tier"]) => position("support", tier);

function player(
	team: string,
	role: Role,
	level: number,
	mains: string[],
	secondary: string[],
	weak: string[],
): AiContent["players"][number] {
	return { id: `${team}-${role}`, team, role, level, mains, secondary, weak };
}

export const packagedDraftContent: AiContent = {
	champions: [
		champion("cragbell", [top("S")], "physical", "mid", "tank", "engage"),
		champion("rimefoil", [top("B"), mid("A")], "magic", "early", "poke"),
		champion("saltspire", [top("A")], "physical", "late", "splitpush"),
		champion("mosshelm", [top("B")], "mixed", "late", "tank", "peel"),
		champion("siltwing", [top("C")], "physical", "early", "dive"),
		champion("quillforge", [top("D")], "magic", "mid", "poke"),
		champion("urnward", [top("B"), support("C")], "utility", "mid", "peel"),
		champion("fallowhorn", [top("A")], "mixed", "early", "skirmish"),
		champion("coalstride", [jungle("S+")], "physical", "early", "dive"),
		champion("duskroot", [jungle("A")], "magic", "mid", "pick"),
		champion("reedclaw", [jungle("B")], "physical", "early", "skirmish"),
		champion("bellwisp", [jungle("C")], "magic", "late", "poke"),
		champion("nettleguard", [jungle("B")], "utility", "mid", "peel"),
		champion("chalkmaw", [jungle("D")], "physical", "mid", "tank"),
		champion("frostdrum", [jungle("A"), top("B")], "mixed", "early", "engage"),
		champion("ashmoth", [jungle("B")], "magic", "late", "carry"),
		champion("prismoth", [mid("S")], "magic", "late", "poke"),
		champion("glasswake", [mid("A")], "magic", "mid", "poke"),
		champion("waxblade", [mid("B")], "physical", "early", "dive"),
		champion("tideglass", [mid("B"), bot("C")], "magic", "mid", "carry"),
		champion("cinderlens", [mid("C")], "mixed", "early", "pick"),
		champion("rushquill", [mid("D")], "physical", "mid", "splitpush"),
		champion("mistloom", [mid("B")], "utility", "late", "peel"),
		champion("silkflare", [mid("A")], "magic", "late", "hypercarry"),
		champion("suncord", [bot("S+")], "physical", "late", "hypercarry"),
		champion("copperfin", [bot("A")], "physical", "mid", "carry"),
		champion("briarshot", [bot("B")], "physical", "early", "poke"),
		champion("spraylark", [bot("C")], "mixed", "mid", "carry"),
		champion("rillbow", [bot("D")], "physical", "late", "carry"),
		champion("starloom", [bot("A")], "magic", "late", "poke"),
		champion("whetstone", [bot("B")], "physical", "early", "skirmish"),
		champion("hushwire", [bot("B")], "mixed", "mid", "pick"),
		champion("shellward", [support("S")], "utility", "mid", "peel"),
		champion("bronzehook", [support("A")], "physical", "early", "engage"),
		champion("riftchime", [support("B")], "magic", "early", "poke"),
		champion("fenveil", [support("C")], "utility", "late", "utility"),
		champion("amberwall", [support("B")], "utility", "mid", "tank"),
		champion("mirethorn", [support("D")], "mixed", "early", "pick"),
		champion("dewshroud", [support("A")], "utility", "late", "peel"),
		champion("rushbell", [support("B")], "physical", "early", "dive"),
	],
	matchups: [
		{ champion: "rimefoil", against: "cragbell", role: "top", value: 5 },
		{ champion: "glasswake", against: "rimefoil", role: "mid", value: 4 },
		{ champion: "glasswake", against: "waxblade", role: "mid", value: -3 },
		{ champion: "saltspire", against: "mosshelm", role: "top", value: 3 },
		{ champion: "coalstride", against: "duskroot", role: "jungle", value: 4 },
		{ champion: "briarshot", against: "suncord", role: "bot", value: 3 },
		{ champion: "bronzehook", against: "shellward", role: "support", value: 2 },
	],
	synergies: [
		{ a: "shellward", b: "suncord", value: 6 },
		{ a: "cragbell", b: "duskroot", value: 4 },
		{ a: "bronzehook", b: "coalstride", value: 5 },
		{ a: "glasswake", b: "briarshot", value: 3 },
		{ a: "urnward", b: "ashmoth", value: 2 },
	],
	identities: [
		{ id: "siege", archetypes: ["poke"], threshold: 2 },
		{
			id: "backline",
			archetypes: ["carry", "hypercarry", "peel"],
			threshold: 2,
		},
		{ id: "collapse", archetypes: ["engage", "dive"], threshold: 2 },
		{ id: "sidelanes", archetypes: ["splitpush", "skirmish"], threshold: 2 },
		{ id: "ambush", archetypes: ["pick", "utility"], threshold: 3 },
	],
	players: [
		player(
			"forge",
			"top",
			90,
			["cragbell", "rimefoil"],
			["saltspire"],
			["siltwing"],
		),
		player("forge", "jungle", 81, ["duskroot"], ["coalstride"], ["reedclaw"]),
		player("forge", "mid", 94, ["glasswake"], ["rimefoil"], ["waxblade"]),
		player("forge", "bot", 79, ["copperfin"], ["suncord"], ["briarshot"]),
		player(
			"forge",
			"support",
			65,
			["bronzehook"],
			["shellward"],
			["riftchime"],
		),
		player("shoal", "top", 72, ["saltspire"], ["mosshelm"], ["cragbell"]),
		player("shoal", "jungle", 85, ["coalstride"], ["duskroot"], ["ashmoth"]),
		player("shoal", "mid", 83, ["waxblade"], ["prismoth"], ["rimefoil"]),
		player("shoal", "bot", 99, ["suncord"], ["copperfin"], ["rillbow"]),
		player("shoal", "support", 61, ["shellward"], ["fenveil"], ["bronzehook"]),
	],
};
