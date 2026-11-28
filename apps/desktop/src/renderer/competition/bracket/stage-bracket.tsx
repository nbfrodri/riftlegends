import { type BracketView, CONTRACT_VERSION } from "@rift-legends/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../../shared/bridge";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { useActiveSeason } from "../active-season";
import { useTeams } from "../season";
import { Bracket } from "./bracket";
import { BracketDraw } from "./bracket-draw";
import { bracketLabels } from "./bracket-labels";

// The bracket of one stage of the exhibition season (#605), read again after
// every played day. Before its teams are known the stage has no bracket (`null`).

const seasonFact = (fact: CoreFact) => fact.type.startsWith("competition.");

export function StageBracket({
	sessionId,
	competition,
	stage,
}: {
	sessionId: number;
	competition: string;
	stage: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	// The tournament opens its series under /torneo, the exhibition season under /competicion.
	const { seriesRoute } = useActiveSeason();
	const team = useTeams(sessionId);
	const bracket = useCoreQuery<BracketView | null>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.bracket",
			sessionId,
			params: { competition, stage },
		},
		{ affectedBy: seasonFact },
	);
	if (bracket.error) return <CoreErrorMessage error={bracket.error} />;
	if (bracket.data === undefined) return null;
	if (bracket.data === null)
		return (
			<p className="text-muted">{t("competition.standings.notStarted")}</p>
		);
	const { draw, matches } = bracket.data;
	const first = matches.find(
		(match) => match.round === 1 && match.side === "upper",
	);
	const round = first && bracketLabels(matches).get(first.id)?.round;
	return (
		<>
			{draw && round && <BracketDraw draw={draw} round={round} team={team} />}
			<Bracket
				bracket={bracket.data}
				team={team}
				onOpenSeries={(series) =>
					void navigate({
						to: seriesRoute,
						params: { series },
					})
				}
			/>
		</>
	);
}
