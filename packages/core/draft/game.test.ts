import { describe, expect, it } from "vitest";
import { act, assignRoles, type GameDraft, newGame, turn } from "./game";
import { DRAFT_ORDER } from "./order";

const BLUE = "t1";
const RED = "geng";

/** Plays the 20 actions of a game, picking `b0`, `r0`, … and banning `x0`, … */
const playAll = (game: GameDraft) => {
	let state = game;
	DRAFT_ORDER.forEach((step, index) => {
		const team = step.side === "blue" ? BLUE : RED;
		const champion =
			step.action === "ban" ? `x${index}` : `${step.side[0]}${index}`;
		const result = act(state, team, step.action, champion);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		state = result.value;
	});
	return state;
};

const picksOf = (game: GameDraft, side: "blue" | "red") => game.picks[side];

const rolesFor = (picks: readonly string[]) => ({
	top: picks[0] as string,
	jungle: picks[1] as string,
	mid: picks[2] as string,
	bot: picks[3] as string,
	support: picks[4] as string,
});

describe("order (O1)", () => {
	it("follows the professional sequence of 20 actions", () => {
		const sequence = DRAFT_ORDER.map((s) => `${s.side[0]}${s.action[0]}`);
		expect(sequence.join(" ")).toBe(
			[
				"bb rb bb rb bb rb",
				"bp rp rp bp bp rp",
				"rb bb rb bb",
				"rp bp bp rp",
			].join(" "),
		);
	});

	it("gives each turn to the right team and action", () => {
		let game = newGame(BLUE, RED);
		DRAFT_ORDER.forEach((step, index) => {
			const team = step.side === "blue" ? BLUE : RED;
			expect(turn(game)).toEqual({
				team,
				side: step.side,
				action: step.action,
			});
			const champion = step.action === "ban" ? null : `c${index}`;
			const result = act(game, team, step.action, champion);
			if (!result.ok) throw new Error(JSON.stringify(result.error));
			game = result.value;
		});
		expect(turn(game)).toEqual({ team: BLUE, side: "blue", action: "roles" });
	});

	it("ends with five picks and five bans per side", () => {
		const game = playAll(newGame(BLUE, RED));
		expect(game.picks.blue).toHaveLength(5);
		expect(game.picks.red).toHaveLength(5);
		expect(game.bans.blue).toHaveLength(5);
		expect(game.bans.red).toHaveLength(5);
	});
});

describe("turns (O2)", () => {
	it("reject the team whose turn it is not", () => {
		const game = newGame(BLUE, RED);
		expect(act(game, RED, "ban", "ahri")).toEqual({
			ok: false,
			error: { code: "not-your-turn", params: { team: RED } },
		});
	});

	it("reject a team outside the game", () => {
		expect(act(newGame(BLUE, RED), "fnc", "ban", "ahri")).toMatchObject({
			ok: false,
			error: { code: "not-your-turn" },
		});
	});

	it("reject a pick during bans and a ban during picks", () => {
		const game = newGame(BLUE, RED);
		expect(act(game, BLUE, "pick", "ahri")).toEqual({
			ok: false,
			error: { code: "wrong-action", params: { expected: "ban" } },
		});
		let state = game;
		for (const step of DRAFT_ORDER.slice(0, 6)) {
			const team = step.side === "blue" ? BLUE : RED;
			state = (act(state, team, "ban", null) as { value: GameDraft }).value;
		}
		expect(act(state, BLUE, "ban", "ahri")).toMatchObject({
			ok: false,
			error: { code: "wrong-action", params: { expected: "pick" } },
		});
	});

	it("leave the game untouched when they reject", () => {
		const game = newGame(BLUE, RED);
		act(game, RED, "ban", "ahri");
		expect(game).toEqual(newGame(BLUE, RED));
	});
});

describe("empty actions (O3)", () => {
	it("allow an empty ban", () => {
		const result = act(newGame(BLUE, RED), BLUE, "ban", null);
		expect(result.ok && result.value.bans.blue).toEqual([null]);
	});

	it("reject an empty pick", () => {
		let state = newGame(BLUE, RED);
		for (const step of DRAFT_ORDER.slice(0, 6)) {
			const team = step.side === "blue" ? BLUE : RED;
			state = (act(state, team, "ban", null) as { value: GameDraft }).value;
		}
		expect(act(state, BLUE, "pick", null)).toMatchObject({
			ok: false,
			error: { code: "invalid-command" },
		});
	});
});

describe("roles (O4)", () => {
	it("are assigned blue first, then red, and close the draft", () => {
		const game = playAll(newGame(BLUE, RED));
		const blue = assignRoles(game, BLUE, rolesFor(picksOf(game, "blue")));
		if (!blue.ok) throw new Error("blue roles rejected");
		expect(turn(blue.value)).toEqual({
			team: RED,
			side: "red",
			action: "roles",
		});
		const red = assignRoles(blue.value, RED, rolesFor(picksOf(game, "red")));
		if (!red.ok) throw new Error("red roles rejected");
		expect(turn(red.value)).toBeNull();
		expect(red.value.roles.red?.bot).toBe(picksOf(game, "red")[3]);
	});

	it("cannot be assigned before the last pick", () => {
		expect(
			assignRoles(
				newGame(BLUE, RED),
				BLUE,
				rolesFor(["a", "b", "c", "d", "e"]),
			),
		).toMatchObject({ ok: false, error: { code: "wrong-action" } });
	});

	it("must be sent by the team whose turn it is", () => {
		const game = playAll(newGame(BLUE, RED));
		expect(
			assignRoles(game, RED, rolesFor(picksOf(game, "red"))),
		).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
	});

	it.each([
		[
			"a repeated champion",
			(p: readonly string[]) => [p[0], p[0], p[2], p[3], p[4]],
		],
		[
			"a champion of the rival",
			(p: readonly string[]) => [p[0], p[1], p[2], p[3], "r6"],
		],
		[
			"a champion not picked",
			(p: readonly string[]) => [p[0], p[1], p[2], p[3], "zed"],
		],
	])("reject %s", (_, change) => {
		const game = playAll(newGame(BLUE, RED));
		const picks = change(picksOf(game, "blue")) as string[];
		expect(assignRoles(game, BLUE, rolesFor(picks))).toEqual({
			ok: false,
			error: { code: "invalid-roles", params: {} },
		});
	});
});
