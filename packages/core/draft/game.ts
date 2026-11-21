import type { CoreError, Role, Side } from "@rift-legends/contracts";
import { DRAFT_ORDER, type DraftAction } from "./order";

export type Roles = Readonly<Record<Role, string>>;

/** One game's draft. It never changes: every action returns a new one. */
export interface GameDraft {
	readonly blue: string;
	readonly red: string;
	/** Index of the next step in `DRAFT_ORDER`. */
	readonly step: number;
	readonly bans: Readonly<Record<Side, readonly (string | null)[]>>;
	readonly picks: Readonly<Record<Side, readonly string[]>>;
	readonly roles: Readonly<Partial<Record<Side, Roles>>>;
}

export type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: CoreError };

export type Turn = {
	team: string;
	side: Side;
	action: DraftAction | "roles";
};

const fail = (
	code: CoreError["code"],
	params: CoreError["params"] = {},
): { ok: false; error: CoreError } => ({ ok: false, error: { code, params } });

export const newGame = (blue: string, red: string): GameDraft => ({
	blue,
	red,
	step: 0,
	bans: { blue: [], red: [] },
	picks: { blue: [], red: [] },
	roles: {},
});

/** Who acts next and how; `null` once both teams have assigned roles. */
export const turn = (game: GameDraft): Turn | null => {
	const step = DRAFT_ORDER[game.step];
	if (step)
		return { team: game[step.side], side: step.side, action: step.action };
	if (!game.roles.blue)
		return { team: game.blue, side: "blue", action: "roles" };
	if (!game.roles.red) return { team: game.red, side: "red", action: "roles" };
	return null;
};

const check = (
	game: GameDraft,
	team: string,
	action: Turn["action"],
): Result<Turn> => {
	const next = turn(game);
	if (!next || next.action !== action) {
		return fail("wrong-action", { expected: next?.action ?? "none" });
	}
	if (next.team !== team) return fail("not-your-turn", { team });
	return { ok: true, value: next };
};

/**
 * Applies a ban or a pick. Only the order is checked here; whether the
 * champion is available is up to the series rules.
 */
export const act = (
	game: GameDraft,
	team: string,
	action: DraftAction,
	champion: string | null,
): Result<GameDraft> => {
	const checked = check(game, team, action);
	if (!checked.ok) return checked;
	const { side } = checked.value;
	if (action === "ban") {
		return {
			ok: true,
			value: {
				...game,
				step: game.step + 1,
				bans: { ...game.bans, [side]: [...game.bans[side], champion] },
			},
		};
	}
	if (champion === null) return fail("invalid-command", { path: "champion" });
	return {
		ok: true,
		value: {
			...game,
			step: game.step + 1,
			picks: { ...game.picks, [side]: [...game.picks[side], champion] },
		},
	};
};

/** Each of the team's five picks takes a different role. */
export const assignRoles = (
	game: GameDraft,
	team: string,
	roles: Roles,
): Result<GameDraft> => {
	const checked = check(game, team, "roles");
	if (!checked.ok) return checked;
	const { side } = checked.value;
	const assigned = new Set(Object.values(roles));
	const picks = game.picks[side];
	if (assigned.size !== picks.length || !picks.every((c) => assigned.has(c))) {
		return fail("invalid-roles");
	}
	return {
		ok: true,
		value: { ...game, roles: { ...game.roles, [side]: { ...roles } } },
	};
};
