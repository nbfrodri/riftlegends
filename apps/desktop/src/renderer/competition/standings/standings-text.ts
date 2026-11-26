import type { StandingsView } from "@rift-legends/contracts";
import type { useTranslation } from "react-i18next";
import { competitionName } from "../names";

// Words of the standings table (plan 31, U3): where a place leads and why a
// tie went the way it did. The core gives both as data.

type TFunction = ReturnType<typeof useTranslation>["t"];
type Row = StandingsView["rows"][number];
type Destination = StandingsView["destinations"][number];
export type Group = "winner" | "loser";

const MINUS = "−";

/** A game difference with its sign: «+5», «−1», «0». */
export const signed = (value: number) =>
	value > 0 ? `+${value}` : value < 0 ? `${MINUS}${-value}` : "0";

/** The destinations that read the table of `group` (the whole table without one). */
export const destinationsOf = (
	destinations: readonly Destination[],
	group?: Group,
) => destinations.filter((destination) => destination.group === group);

/**
 * Where a place leads: the stages and events whose range holds it, or
 * «Eliminated» when none does.
 */
export function destinationText(
	t: TFunction,
	language: string,
	destinations: readonly Destination[],
	rank: number,
	stageOf: (competition: string, stage: string) => string,
) {
	const names = destinations
		.filter(({ from, to }) => from <= rank && rank <= to)
		.map(({ competition, stage }) =>
			stage ? stageOf(competition, stage) : competitionName(t, competition),
		);
	if (!names.length) return t("competition.standings.eliminated");
	return new Intl.ListFormat(language, { type: "conjunction" }).format(names);
}

/**
 * Why a tied team sits where it does, or `undefined` when it was never tied.
 * A team alone on series wins carries `seriesWins`: that is no tie.
 */
export function tieText(
	t: TFunction,
	language: string,
	row: Row,
	order: readonly string[],
	teamName: (id: string) => string,
) {
	const { criterion, tied, values } = row.explanation;
	if (tied.length < 2 || criterion === "seriesWins") return undefined;
	const list = new Intl.ListFormat(language, { type: "conjunction" });
	const others = tied.filter((team) => team !== row.team).map(teamName);
	const heading = t("competition.standings.tie.with", {
		teams: list.format(others),
	});
	if (criterion === "none")
		return { heading, content: t("competition.standings.tie.pending") };
	if (criterion === "draw")
		return { heading, content: t("competition.standings.tie.draw") };
	const rank = (team: string) => {
		const index = order.indexOf(team);
		return index === -1 ? order.length : index;
	};
	const value = (team: string) => {
		const raw = values[team] ?? 0;
		if (criterion === "gameDiff") return signed(raw);
		if (criterion === "victoryTime")
			return t("competition.standings.minutes", {
				count: Math.round(raw / 60),
			});
		return String(raw);
	};
	const shown = [...tied]
		.sort((a, b) => rank(a) - rank(b))
		.map((team) => `${teamName(team)} ${value(team)}`)
		.join(", ");
	return {
		heading,
		content: t(`competition.standings.tie.${criterion}`, { values: shown }),
	};
}
