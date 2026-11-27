import { type BracketView, CONTRACT_VERSION } from "@rift-legends/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../../shared/bridge";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { useTeams } from "../season";
import { Bracket } from "./bracket";

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
	return (
		<Bracket
			bracket={bracket.data}
			team={team}
			onOpenSeries={(series) =>
				void navigate({
					to: "/competicion/serie/$series",
					params: { series },
				})
			}
		/>
	);
}
