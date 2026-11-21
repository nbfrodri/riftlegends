import { ROLES, type Role } from "@rift-legends/contracts";
import { choose, DIFFICULTY, difficultyOf, type Scored } from "../ai/choose";
import { scoreBan } from "../ai/components/ban";
import { comfort } from "../ai/components/comfort";
import { meta } from "../ai/components/meta";
import { scorePick } from "../ai/components/pick";
import { indexContent } from "../ai/content-index";
import type { AiContext } from "../ai/context";
import { lookahead } from "../ai/lookahead";
import { PROFILES } from "../ai/profiles";
import { SCOPES } from "../rng/scopes";
import { deriveSeed } from "../rng/seeds";
import { createRng } from "../rng/streams";
import type { CommandHandler } from "../server/dispatcher";
import { availability } from "./availability";
import { type GameDraft, turn } from "./game";
import {
	apply,
	availabilityInput,
	done,
	fail,
	type SeriesConfig,
	type SeriesState,
	seriesCommands,
	WINS_NEEDED,
} from "./series";

const LOOKAHEAD_SHORTLIST = 5;
const total = (s: Scored) => s.components.reduce((sum, c) => sum + c.points, 0);
const settingsOf = (config: SeriesConfig, team: string) =>
	config.ai?.[config.teams.indexOf(team)] ?? null;

/** The five picks in the roles that best fit tier and comfort; ties keep `ROLES` order. */
const bestRoles = (
	state: SeriesState,
	team: string,
	picks: readonly string[],
) => {
	const index = indexContent(
		state.content as NonNullable<SeriesState["content"]>,
	);
	const roster = index.rosters.get(team);
	const fit = (champion: string, role: Role) => {
		const tier = index.champions
			.get(champion)
			?.positions.find((p) => p.role === role)?.tier;
		return (
			(tier ? meta(tier) : -100_000) + comfort(roster?.get(role), champion)
		);
	};
	let best: { score: number; order: string[] } | null = null;
	const permute = (left: readonly string[], order: string[], score: number) => {
		if (left.length === 0) {
			if (!best || score > best.score) best = { score, order };
			return;
		}
		const role = ROLES[order.length] as Role;
		for (const champion of left) {
			permute(
				left.filter((c) => c !== champion),
				[...order, champion],
				score + fit(champion, role),
			);
		}
	};
	permute(picks, [], 0);
	const order = (best as { order: string[] } | null)?.order ?? [...picks];
	return Object.fromEntries(ROLES.map((role, i) => [role, order[i]])) as Record<
		Role,
		string
	>;
};

/**
 * `draft.ai` (plan 07): the AI of the team whose turn it is acts. Bans and
 * picks emit `ai.decided` with the breakdown right before the action.
 */
export const aiTurn: CommandHandler<SeriesState> = (state) => {
	const { config } = state;
	if (state.phase === "over") return fail("series-over");
	if (!config || !state.content)
		return fail("wrong-action", { expected: "start" });

	if (state.phase === "side") {
		const team = state.chooser as string;
		if (!settingsOf(config, team))
			return fail("wrong-action", { expected: "human" });
		return seriesCommands["side.choose"](state, { team, side: "blue" });
	}
	if (state.phase !== "draft")
		return fail("wrong-action", { expected: state.phase });

	const draft = state.draft as GameDraft;
	const next = turn(draft);
	if (!next) return fail("wrong-action", { expected: "result" });
	const settings = settingsOf(config, next.team);
	if (!settings) return fail("wrong-action", { expected: "human" });
	if (next.action === "roles") {
		const roles = bestRoles(state, next.team, draft.picks[next.side]);
		return seriesCommands["draft.roles"](state, { team: next.team, roles });
	}

	const difficulty = difficultyOf(settings);
	const rules = DIFFICULTY[difficulty];
	const rival =
		next.team === config.teams[0] ? config.teams[1] : config.teams[0];
	const mine = config.teams.indexOf(next.team);
	const input = availabilityInput(config, state);
	const ctx: AiContext = {
		content: state.content,
		team: next.team,
		rival,
		side: next.side,
		step: draft.step,
		picks: input.picks,
		bans: input.bans,
		fearless: config.fearless,
		game: state.game,
		wins: [state.wins[mine] as number, state.wins[1 - mine] as number],
		winsNeeded: WINS_NEEDED[config.format],
		knowsRivalPools: rules.readsRival,
	};
	const free = (team: string, picks: AiContext["picks"]) =>
		availability({ ...input, picks }, team)
			.filter((entry) => entry.status === "free")
			.map((entry) => entry.champion);

	const score = next.action === "ban" ? scoreBan : scorePick;
	const scored = free(next.team, input.picks)
		.map((champion) => ({ champion, components: score(ctx, champion) }))
		.sort((a, b) => total(b) - total(a) || (a.champion < b.champion ? -1 : 1));
	if (scored.length === 0) {
		return apply(state, next.team, "ban", null, false);
	}
	const shortlist = scored.slice(0, LOOKAHEAD_SHORTLIST);
	const ahead = lookahead(ctx, shortlist, rules.lookahead as 0 | 1 | 2, free);
	const candidates = [
		...ahead.candidates,
		...scored.slice(LOOKAHEAD_SHORTLIST),
	];

	const rng = createRng(
		deriveSeed(config.seed, SCOPES.ai, state.game, draft.step),
	);
	const decision = choose(
		rng,
		candidates,
		PROFILES[settings.personality],
		difficulty,
	);
	const reply = ahead.replies.get(decision.champion);
	const acted = apply(state, next.team, next.action, decision.champion, false);
	if (!acted.ok) return acted;
	return done(
		acted.state,
		{
			type: "ai.decided",
			game: state.game,
			step: draft.step,
			team: next.team,
			action: next.action,
			champion: decision.champion,
			total: decision.total,
			components: decision.components,
			alternatives: decision.alternatives,
			...(reply ? { reply } : {}),
		},
		...acted.facts,
	);
};
