// SPIKE S2 (#74), THROW-AWAY: 500 fictional players with stable IDs, generated
// deterministically (mulberry32). No Riot data. Shared by the renderer and the
// measurement script so the expected order is computed independently of the DOM.

import type { PlaceholderPlayer, PlayerRole } from "./placeholder-players";

const roles: readonly PlayerRole[] = ["top", "jungle", "mid", "bot", "support"];
const teams = [
	"Bruma",
	"Ascua",
	"Duna",
	"Marea",
	"Cumbre",
	"Aurora",
	"Ceniza",
	"Rocio",
	"Alud",
	"Estela",
];
const first = [
	"Nad",
	"Veg",
	"Lum",
	"Bris",
	"Cob",
	"Oni",
	"Dun",
	"Eco",
	"Fen",
	"Gal",
	"Hel",
	"Iri",
	"Jad",
	"Kai",
	"Lir",
	"Mal",
	"Nie",
	"Ori",
	"Plu",
	"Qua",
];
const last = ["ir", "a", "en", "o", "ix", "us", "el", "an", "or", "ia"];

function mulberry32(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function generatePlayers(
	count = 500,
	seed = 74,
): readonly PlaceholderPlayer[] {
	const random = mulberry32(seed);
	const int = (min: number, max: number) =>
		min + Math.floor(random() * (max - min + 1));
	const pick = <T>(list: readonly T[]) => list[int(0, list.length - 1)] as T;
	return Array.from({ length: count }, (_, index) => ({
		id: `p-${String(index + 1).padStart(4, "0")}`,
		// Duplicated names on purpose: exercises stable sorting by ID order.
		name: pick(first) + pick(last),
		role: pick(roles),
		team: pick(teams),
		age: int(17, 34),
		rating: int(55, 95),
		form: int(-12, 12),
		contractEnd: `${int(2027, 2030)}-${String(int(1, 12)).padStart(2, "0")}-28`,
		salary: int(18, 200) * 100,
	}));
}

export const spikePlayers = generatePlayers();
