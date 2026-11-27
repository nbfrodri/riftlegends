import { CONTRACT_VERSION, type StandingsView } from "@rift-legends/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../../shared/bridge";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { useTeams } from "../season";
import { SwissRounds } from "./swiss-rounds";

// The Swiss rounds of one stage of the exhibition season (#487), from its
// standings, read again after every played day.

const seasonFact = (fact: CoreFact) => fact.type.startsWith("competition.");

export function StageSwiss({
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
	const standings = useCoreQuery<StandingsView | null>(
		{
			v: CONTRACT_VERSION,
			kind: "competition.standings",
			sessionId,
			params: { competition, stage },
		},
		{ affectedBy: seasonFact },
	);
	if (standings.error) return <CoreErrorMessage error={standings.error} />;
	if (standings.data === undefined) return null;
	if (!standings.data?.swiss)
		return (
			<p className="text-muted">{t("competition.standings.notStarted")}</p>
		);
	return (
		<SwissRounds
			swiss={standings.data.swiss}
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
