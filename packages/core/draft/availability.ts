import type { CoreError } from "@rift-legends/contracts";

export type Fearless = "hard" | "soft" | "off";
export type Format = "bo1" | "bo3" | "bo5";

export interface AvailabilityInput {
	readonly pool: readonly string[];
	readonly fearless: Fearless;
	/** Picks of each finished game, by team id. */
	readonly previous: readonly Readonly<Record<string, readonly string[]>>[];
	readonly bans: readonly (string | null)[];
	readonly picks: Readonly<Record<string, readonly string[]>>;
}

export type Availability =
	| { champion: string; status: "free" }
	| { champion: string; status: "banned" }
	| { champion: string; status: "picked" | "fearless"; team: string };

function championLocks(input: AvailabilityInput, team: string) {
	const locks = new Map<string, Availability>();
	if (input.fearless !== "off") {
		for (const game of input.previous) {
			for (const [owner, picks] of Object.entries(game)) {
				if (input.fearless === "soft" && owner !== team) continue;
				for (const champion of picks) {
					locks.set(champion, { champion, status: "fearless", team: owner });
				}
			}
		}
	}
	// Current bans override fearless locks; current picks take precedence over both.
	for (const champion of input.bans) {
		if (champion !== null) locks.set(champion, { champion, status: "banned" });
	}
	for (const [owner, picks] of Object.entries(input.picks)) {
		for (const champion of picks) {
			locks.set(champion, { champion, status: "picked", team: owner });
		}
	}
	return locks;
}

export function availability(
	input: AvailabilityInput,
	team: string,
): Availability[] {
	const locks = championLocks(input, team);
	return input.pool.map(
		(champion) => locks.get(champion) ?? { champion, status: "free" },
	);
}

export function checkChampion(
	input: AvailabilityInput,
	team: string,
	action: "ban" | "pick",
	champion: string,
): { ok: true } | { ok: false; error: CoreError } {
	if (input.pool.includes(champion)) {
		const lock = championLocks(input, team).get(champion);
		if (!lock || (action === "ban" && lock.status === "fearless")) {
			return { ok: true };
		}
	}
	return {
		ok: false,
		error: { code: "champion-unavailable", params: { champion } },
	};
}

const games = { bo1: 1, bo3: 3, bo5: 5 } as const;

export function requiredPool(format: Format, fearless: Fearless): number {
	return fearless === "off" ? 20 : (games[format] - 1) * 10 + 20;
}
