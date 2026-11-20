import { uniformInt } from "pure-rand/distribution/uniformInt";
import {
	xoroshiro128plus,
	xoroshiro128plusFromState,
} from "pure-rand/generator/xoroshiro128plus";

const blue = "Sable Choir";
const red = "Copper Wake";
const champions = [
	"Ashloom",
	"Bellwing",
	"Cairnfox",
	"Duskrail",
	"Emberlark",
	"Frostquill",
	"Galehook",
	"Hushfin",
	"Inkthorn",
	"Jadecrest",
	"Knellroot",
	"Loomhart",
	"Mirebell",
	"Nettlewing",
	"Opalhorn",
	"Pineshard",
	"Quillwake",
	"Rillmoth",
	"Siltmane",
	"Tidewren",
	"Umberkin",
	"Veilfern",
	"Wickgale",
	"Yewglass",
];

type Team = typeof blue | typeof red;
type Action = "ban" | "pick";
const turns: readonly (readonly [Action, Team])[] = [
	["ban", blue],
	["ban", red],
	["ban", blue],
	["ban", red],
	["ban", blue],
	["ban", red],
	["pick", blue],
	["pick", red],
	["pick", red],
	["pick", blue],
	["pick", blue],
	["pick", red],
	["ban", red],
	["ban", blue],
	["ban", red],
	["ban", blue],
	["pick", red],
	["pick", blue],
	["pick", blue],
	["pick", red],
];

type Fact =
	| ["series", number, number, Team, Team]
	| ["game", number]
	| [Action, number, number, Team, string]
	| ["result", number, number, number, number, number, Team]
	| ["winner", Team, number, number];

export function seedFor(
	rootSeed: number,
	scope: "draft" | "match",
	seriesId: number,
	gameId: number,
) {
	// FNV-1a-32 over four little-endian uint32 words.
	let hash = 2166136261n;
	for (const word of [rootSeed, scope === "draft" ? 1 : 2, seriesId, gameId]) {
		if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) {
			throw new RangeError("Seed and IDs must fit uint32");
		}
		for (let shift = 0; shift < 32; shift += 8) {
			const byte = (word >>> shift) & 255;
			hash = ((hash ^ BigInt(byte)) * 16777619n) & 0xffffffffn;
		}
	}
	return Number(hash);
}

function startGame(rootSeed: number, seriesId: number, id: number) {
	return {
		id,
		bans: [] as string[],
		picks: [] as string[],
		strength: { [blue]: 0, [red]: 0 },
		rng: {
			draft: xoroshiro128plus(
				seedFor(rootSeed, "draft", seriesId, id),
			).getState(),
			match: xoroshiro128plus(
				seedFor(rootSeed, "match", seriesId, id),
			).getState(),
		},
	};
}

export function startSeries(rootSeed: number, seriesId: number) {
	const facts: Fact[] = [
		["series", rootSeed, seriesId, blue, red],
		["game", 1],
	];
	return {
		rootSeed,
		seriesId,
		wins: { [blue]: 0, [red]: 0 },
		game: startGame(rootSeed, seriesId, 1),
		facts,
	};
}

type Series = ReturnType<typeof startSeries>;

export function nextTurn({ game }: Series) {
	return turns[game.bans.length + game.picks.length];
}

function finishGame(series: Series) {
	const { game, wins, facts } = series;
	const rng = xoroshiro128plusFromState(game.rng.match);
	const blueRoll = uniformInt(rng, 0, 99);
	const redRoll = uniformInt(rng, 0, 99);
	game.rng.match = rng.getState();
	const winner =
		game.strength[blue] + blueRoll >= game.strength[red] + redRoll ? blue : red;
	facts.push([
		"result",
		game.id,
		game.strength[blue],
		blueRoll,
		game.strength[red],
		redRoll,
		winner,
	]);
	wins[winner]++;
	if (wins[winner] === 2) {
		facts.push(["winner", winner, wins[blue], wins[red]]);
	} else {
		series.game = startGame(series.rootSeed, series.seriesId, game.id + 1);
		facts.push(["game", series.game.id]);
	}
}

// Omitting the champion asks the current team to choose from the ordered pool.
export function playTurn(
	series: Series,
	action: Action,
	team: Team,
	champion?: string,
) {
	const turn = nextTurn(series);
	if (!turn) return "series-finished";
	if (action !== turn[0] || team !== turn[1]) return "wrong-turn";
	const { game } = series;
	if (champion === undefined) {
		const pool = champions.filter(
			(name) => !game.bans.includes(name) && !game.picks.includes(name),
		);
		const rng = xoroshiro128plusFromState(game.rng.draft);
		champion = pool[uniformInt(rng, 0, pool.length - 1)];
		if (champion === undefined) throw new Error("Draft pool exhausted");
		game.rng.draft = rng.getState();
	} else {
		if (!champions.includes(champion)) return "unknown-champion";
		if (game.bans.includes(champion)) return "banned";
		if (game.picks.includes(champion)) return "already-picked";
	}
	if (action === "pick") {
		game.picks.push(champion);
		game.strength[team] += 1 + (champions.indexOf(champion) % 5);
	} else {
		game.bans.push(champion);
	}
	series.facts.push([
		action,
		game.id,
		game.bans.length + game.picks.length,
		team,
		champion,
	]);
	if (!nextTurn(series)) finishGame(series);
	return "accepted";
}

export function finishSeries(series: Series) {
	let turn = nextTurn(series);
	while (turn) {
		playTurn(series, ...turn);
		turn = nextTurn(series);
	}
	return series;
}

export function canonicalLog(facts: readonly Fact[]) {
	return facts.map((fact) => `${JSON.stringify(fact)}\n`).join("");
}
