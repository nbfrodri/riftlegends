import {
	competitionCommands,
	draftCommands,
	parseCommand,
	ROLES,
} from "@rift-legends/contracts";
import { expect, test } from "vitest";
import { packagedDraftContent, packagedMatchContent } from "../content";
import { openSession } from "../server/dispatcher";
import { CONTENT_VERSION } from "../version";
import {
	type SeasonSession,
	seasonDispatcher,
	seasonStateWith,
} from "./handlers";

type Fact = Record<string, unknown> & { type: string };

const teams = ["forge", "shoal", "breakwater", "sunspoke"].map((id, rank) => ({
	id,
	competition: "league",
	region: "region",
	rank: rank + 1,
}));
const season = {
	year: 2026,
	seed: 42,
	humanTeam: "forge",
	teams,
	competitions: [
		{
			id: "league",
			kind: "league",
			verified: false,
			tiebreakerBestOf: 3,
			fearless: "hard",
			tiebreak: ["seriesWins", "gameDiff", "headToHead"],
			stages: [
				{
					id: "split",
					window: { startWeek: 0, weeks: 2, matchDays: 7, maxSeriesPerDay: 4 },
					entrants: { kind: "fixed", teams: teams.map(({ id }) => id) },
					play: { type: "roundRobin", size: 4, rounds: 1, bestOf: 3 },
				},
			],
		},
	],
};

function core() {
	let session = openSession<SeasonSession>(
		1,
		seasonStateWith(function* () {
			yield {
				content: packagedDraftContent,
				match: packagedMatchContent,
				version: CONTENT_VERSION,
			};
		}),
	);
	const send = (kind: string, payload: object): Fact[] => {
		const envelope = {
			v: 1,
			sessionId: 1,
			kind,
			expectedPosition: session.position,
			payload,
		};
		const parsed = kind.startsWith("season.")
			? parseCommand(competitionCommands, envelope)
			: parseCommand(draftCommands, envelope);
		if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
		const handled = seasonDispatcher.handle(session, parsed.command);
		if (!handled.response.ok)
			throw new Error(`${kind}: ${JSON.stringify(handled.response.error)}`);
		session = handled.session;
		return handled.response.facts as Fact[];
	};
	const query = (kind: string, params: object) => {
		const result = seasonDispatcher.query(session, {
			v: 1,
			sessionId: 1,
			kind,
			params,
		});
		if (!result.ok) throw new Error(`${kind}: ${JSON.stringify(result.error)}`);
		return result.view as Record<string, unknown>;
	};
	return { send, query };
}

type Core = ReturnType<typeof core>;
interface DraftView {
	phase: string;
	turn: { team: string; action: string; options?: string[] } | null;
	blue: { team: string; picks: string[] };
	red: { team: string; picks: string[] };
	availability: { champion: string; status: string }[];
}

/**
 * Plays the user's series with choices the coach AI would not make: the last
 * side option, no bans and the last free champion of the pool.
 */
function playAgainstTheGrain({ send, query }: Core, series: string) {
	const facts = send("season.playSeries", { series, timer: false });
	for (let guard = 0; guard < 400; guard++) {
		if (facts.some(({ type }) => type === "competition.seriesRecorded"))
			return facts;
		const view = query("draft.view", {}) as unknown as DraftView;
		const { turn } = view;
		if (view.phase === "result") facts.push(...send("match.play", {}));
		else if (turn?.team !== "forge") facts.push(...send("draft.ai", {}));
		else if (turn.action === "side")
			facts.push(
				...send("side.choose", {
					team: "forge",
					choice: turn.options?.at(-1),
				}),
			);
		else if (turn.action === "ban")
			facts.push(...send("draft.ban", { team: "forge", champion: null }));
		else if (turn.action === "pick") {
			const free = view.availability.filter(({ status }) => status === "free");
			facts.push(
				...send("draft.pick", {
					team: "forge",
					champion: free.at(-1)?.champion,
				}),
			);
		} else {
			const mine = view.blue.team === "forge" ? view.blue : view.red;
			const roles = Object.fromEntries(
				ROLES.map((role, index) => [role, mine.picks[index]]),
			);
			facts.push(...send("draft.roles", { team: "forge", roles }));
		}
	}
	throw new Error("the series never ended");
}

test("#649: the user's series detail is the series the user played", () => {
	const client = core();
	client.send("season.create", season);
	const day = client.send("season.playDay", { day: 0 });
	const pending = day.find(({ type }) => type === "competition.seriesPending");
	const schedule = client.query("competition.schedule", {
		team: "forge",
	}) as unknown as { id: string; day: number }[];
	const slot = schedule.find(({ day }) => day === pending?.day);
	expect(slot).toBeDefined();
	const id = slot?.id as string;
	const facts = playAgainstTheGrain(client, id);
	const games = facts.filter(({ type }) => type === "match.ended").length;
	expect(games).toBeGreaterThanOrEqual(2);

	const played = client.query("series.summary", {});
	expect(client.query("series.summary", { series: id })).toEqual(played);
	for (let game = 1; game <= games; game++)
		expect(client.query("match.view", { series: id, game })).toEqual(
			client.query("match.view", { game }),
		);
});
