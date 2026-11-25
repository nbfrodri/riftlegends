import {
	CONTRACT_VERSION,
	type ContentDatabase,
} from "@rift-legends/contracts";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoreErrorMessage, useCoreQuery } from "../core";
import { useRealBlock } from "../draft/real-content";
import { DraftSessionProvider, useDraftSession } from "../draft/session";
import { LEAGUES } from "../draft/setup-screen";
import { type DatabasePlayer, databasePlayers } from "./database-filters";
import { CoachTable, PlayerTable } from "./database-tables";
import { type OpenPlayer, PlayerDialog } from "./player-dialog";
import { TeamList } from "./team-list";

// The database section (#443): every player, team and coach of the content.

type Tab = "players" | "teams" | "coaches";

const noFact = () => false;

const leagueRank = (league = "") =>
	LEAGUES.includes(league) ? LEAGUES.indexOf(league) : LEAGUES.length;

/** The `/base-de-datos` route: its own core session, outside any series. */
export function DatabaseScreen() {
	return (
		<DraftSessionProvider>
			<Database />
		</DraftSessionProvider>
	);
}

function Database() {
	const { t } = useTranslation();
	const { sessionId, content, options } = useDraftSession();
	const block = useRealBlock(sessionId);
	const blocked = content === "real" && block !== null;
	const [tab, setTab] = useState<Tab>("players");
	const [open, setOpen] = useState<OpenPlayer | null>(null);
	const query = useCoreQuery<ContentDatabase>(
		{
			v: CONTRACT_VERSION,
			kind: "content.database",
			sessionId,
			params: { content },
		},
		{ affectedBy: noFact, enabled: !blocked },
	);
	const teams = useMemo(
		() =>
			[...(query.data?.teams ?? [])].sort(
				(a, b) =>
					leagueRank(a.league) - leagueRank(b.league) || a.seed - b.seed,
			),
		[query.data],
	);
	const players = useMemo(
		() => (query.data ? databasePlayers(query.data) : []),
		[query.data],
	);
	const championNames = useMemo(
		() => new Map(options.champions.map((c) => [c.id, c.name])),
		[options.champions],
	);
	const openPlayer = (player: DatabasePlayer, trigger: HTMLElement | null) =>
		setOpen({ player, trigger });

	return (
		<section className="flex h-full min-h-0 flex-col gap-[clamp(10px,1.4vh,18px)] px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
					{t("shell.nav.database")}
				</h1>
				<SegmentedControl
					label={t("database.section")}
					value={tab}
					onChange={setTab}
					options={[
						{ value: "players", label: t("database.tab.players") },
						{ value: "teams", label: t("database.tab.teams") },
						{ value: "coaches", label: t("database.tab.coaches") },
					]}
					className="text-[13px]"
				/>
			</header>
			{blocked
				? block !== "checking" && (
						<p className="text-muted">{t("database.missing")}</p>
					)
				: query.data && (
						<>
							{tab === "players" && (
								<PlayerTable
									players={players}
									teams={teams}
									onOpen={openPlayer}
								/>
							)}
							{tab === "teams" && (
								<TeamList teams={teams} players={players} onOpen={openPlayer} />
							)}
							{tab === "coaches" && <CoachTable teams={teams} />}
						</>
					)}
			{query.error && <CoreErrorMessage error={query.error} />}
			{open && (
				<PlayerDialog
					key={open.player.id}
					open={open}
					championNames={championNames}
					onClose={() => setOpen(null)}
				/>
			)}
		</section>
	);
}
