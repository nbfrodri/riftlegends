// PLACEHOLDER DATA: made-up players so the Mercado table has something to
// show (plan 02, T10). Every name, team and figure is invented. It goes away
// when the market reads real players from the core (spike S2 and phase 2);
// do not move it into `packages/core`.

type PlayerRole = "top" | "jungle" | "mid" | "bot" | "support";

export type PlaceholderPlayer = {
	id: string;
	name: string;
	role: PlayerRole;
	team: string;
	age: number;
	rating: number;
	/** Recent change in rating, signed. */
	form: number;
	/** Last day of the contract (ISO date, UTC). */
	contractEnd: string;
	/** Monthly salary in euros. */
	salary: number;
};

type Row = [
	name: string,
	role: PlayerRole,
	team: string,
	age: number,
	rating: number,
	form: number,
	contractEnd: string,
	salary: number,
];

const rows: Row[] = [
	["Nadir", "mid", "Bruma", 22, 84, 4, "2027-06-30", 4500],
	["Vega", "top", "Ascua", 24, 79, -2, "2028-01-31", 12500],
	["Lumen", "jungle", "Duna", 20, 76, 7, "2027-12-31", 8200],
	["Brisa", "support", "Marea", 23, 71, 0, "2027-06-30", 5600],
	["Cobalto", "bot", "Cumbre", 25, 88, 3, "2029-06-30", 18400],
	["Ónix", "top", "Bruma", 19, 68, 9, "2028-06-30", 3100],
	["Dune", "mid", "Ascua", 27, 82, -5, "2026-12-31", 14900],
	["Ecos", "jungle", "Aurora", 21, 74, 2, "2027-06-30", 7300],
	["Fénix", "bot", "Duna", 18, 66, 11, "2029-01-31", 2800],
	["Gala", "support", "Cumbre", 26, 80, 1, "2028-06-30", 9700],
	["Helio", "mid", "Marea", 23, 77, -1, "2027-12-31", 10200],
	["Iris", "top", "Aurora", 28, 85, -4, "2026-12-31", 16800],
	["Jade", "jungle", "Bruma", 22, 81, 5, "2028-12-31", 11400],
	["Kairo", "bot", "Ascua", 24, 83, 2, "2028-06-30", 13700],
	["Lira", "support", "Duna", 20, 69, 6, "2027-06-30", 3900],
	["Malva", "mid", "Cumbre", 21, 78, 8, "2029-01-31", 9100],
	["Niebla", "top", "Marea", 25, 73, -3, "2027-06-30", 6400],
	["Orión", "jungle", "Ascua", 29, 86, -6, "2026-12-31", 17500],
	["Pluma", "bot", "Aurora", 19, 70, 10, "2028-12-31", 4200],
	["Quarzo", "support", "Bruma", 24, 75, 0, "2028-01-31", 7800],
	["Rayo", "mid", "Duna", 26, 87, 1, "2029-06-30", 15600],
	["Sauce", "top", "Cumbre", 20, 72, 5, "2027-12-31", 5100],
	["Tundra", "jungle", "Marea", 23, 79, -2, "2028-06-30", 8900],
	["Umbra", "bot", "Bruma", 22, 80, 3, "2027-06-30", 10800],
	["Vértigo", "support", "Ascua", 27, 77, -1, "2027-06-30", 8400],
	["Wren", "mid", "Aurora", 18, 67, 12, "2029-01-31", 3300],
	["Xenia", "top", "Duna", 24, 81, 2, "2028-12-31", 11900],
	["Yara", "jungle", "Cumbre", 25, 84, -3, "2027-12-31", 13200],
	["Zafiro", "bot", "Marea", 21, 75, 4, "2028-06-30", 6900],
	["Alba", "support", "Aurora", 22, 73, 1, "2027-06-30", 5900],
	["Bruno", "mid", "Bruma", 30, 83, -7, "2026-12-31", 12100],
	["Cierzo", "top", "Ascua", 21, 74, 6, "2028-01-31", 6100],
	["Dalia", "jungle", "Duna", 27, 78, 0, "2027-06-30", 9400],
	["Eco", "bot", "Cumbre", 23, 85, 4, "2029-01-31", 16200],
	["Faro", "support", "Marea", 19, 64, 9, "2028-12-31", 2600],
	["Granizo", "mid", "Marea", 25, 80, -2, "2027-12-31", 10500],
];

export const placeholderPlayers: readonly PlaceholderPlayer[] = rows.map(
	([name, role, team, age, rating, form, contractEnd, salary]) => ({
		id: name.toLowerCase(),
		name,
		role,
		team,
		age,
		rating,
		form,
		contractEnd,
		salary,
	}),
);
