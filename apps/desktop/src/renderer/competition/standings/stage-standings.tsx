import { CONTRACT_VERSION, type StandingsView } from "@rift-legends/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { CoreFact } from "../../../shared/bridge";
import { CoreErrorMessage, useCoreQuery } from "../../core";
import { useTeamNames } from "../season";
import { StandingsTables } from "./standings-tables";

// The standings of one stage of the exhibition season, read again after every
// played day. A stage whose teams are not known yet has no table (`null`).

const seasonFact = (fact: CoreFact) => fact.type.startsWith("competition.");

export function StageStandings({
	sessionId,
	competition,
	stage,
}: {
	sessionId: number;
	competition: string;
	stage: string;
}) {
	const { t } = useTranslation();
	const teamName = useTeamNames(sessionId);
	const navigate = useNavigate();
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
	if (standings.data === null)
		return (
			<p className="text-muted">{t("competition.standings.notStarted")}</p>
		);
	return (
		<StandingsTables
			standings={standings.data}
			stage={stage}
			teamName={teamName}
			onOpenTeam={(team) =>
				void navigate({ to: "/competicion/equipo/$team", params: { team } })
			}
		/>
	);
}
