import { CONTRACT_VERSION, type DraftView } from "@rift-legends/contracts";
import { draftDispatcher, initialDraftState } from "../draft/index";
import type { SeriesState } from "../draft/series";
import { pick } from "../rng/helpers";
import { createRng } from "../rng/streams";
import { type Fact, openSession, type Session } from "../server/dispatcher";

export interface PlayOptions {
	readonly seed: number;
	readonly format: "bo1" | "bo3" | "bo5";
	readonly fearless: "hard" | "soft" | "off";
	readonly pool: readonly string[];
	/** Called before each legal command; it may try anything on the session. */
	readonly probe?: (session: Session<SeriesState>, view: DraftView) => void;
}

/**
 * Plays a whole series through the dispatcher with legal random choices
 * drawn from `seed`. Used by the property tests and the draft golden.
 */
export const playSeries = (options: PlayOptions): Fact[] => {
	const rng = createRng(options.seed);
	const facts: Fact[] = [];
	let session = openSession<SeriesState>(1, initialDraftState);
	const send = (kind: string, payload: object) => {
		const result = draftDispatcher.handle(session, {
			v: CONTRACT_VERSION,
			kind,
			sessionId: 1,
			expectedPosition: session.position,
			payload,
		});
		if (!result.response.ok) {
			throw new Error(
				`${kind} rejected: ${JSON.stringify(result.response.error)}`,
			);
		}
		session = result.session;
		facts.push(...result.response.facts);
	};
	const view = () =>
		draftDispatcher.query(session, {
			v: CONTRACT_VERSION,
			kind: "draft.view",
			sessionId: 1,
			params: {},
		});

	send("series.start", {
		teams: ["blue-team", "red-team"],
		seeds: [1, 2],
		format: options.format,
		fearless: options.fearless,
		timer: true,
		pool: options.pool,
		seed: options.seed,
	});
	for (;;) {
		const answer = view();
		if (!answer.ok) throw new Error("draft.view failed");
		const current = answer.view as DraftView;
		if (current.phase === "over") return facts;
		options.probe?.(session, current);
		const turn = current.turn;
		if (current.phase === "result" || !turn) {
			send("game.finish", {
				winner: pick(rng, [current.blue.team, current.red.team]),
			});
		} else if (turn.action === "side") {
			send("side.choose", {
				team: turn.team,
				side: pick(rng, ["blue", "red"]),
			});
		} else if (turn.action === "roles") {
			const [top, jungle, mid, bot, support] = current[turn.side].picks;
			send("draft.roles", {
				team: turn.team,
				roles: { top, jungle, mid, bot, support },
			});
		} else {
			const free = current.availability
				.filter((entry) => entry.status === "free")
				.map((entry) => entry.champion);
			const roll = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
			if (roll === 0) send("draft.timeout", {});
			else if (turn.action === "ban" && roll === 1) {
				send("draft.ban", { team: turn.team, champion: null });
			} else {
				send(`draft.${turn.action}`, {
					team: turn.team,
					champion: pick(rng, free),
				});
			}
		}
	}
};
