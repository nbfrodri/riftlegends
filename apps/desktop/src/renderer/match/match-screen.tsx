import {
	CONTRACT_VERSION,
	type DraftView,
	type MatchView,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { IconButton } from "@rift-legends/ui-kit/components/icon-button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { ArrowRight, Pause, Play, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoreErrorMessage, useCoreQuery } from "../core";
import { PageHeader } from "../draft/page-header";
import { teamName, useDraftSession } from "../draft/session";
import { EventFeed } from "./event-feed";
import { FaceToFace } from "./face-to-face";
import { Objectives, Structures } from "./map-tables";
import { clockTime, speeds, usePlayback } from "./playback";
import { GoldChart, TeamTotals } from "./scoreboard";
import "./match.css";

function Replay({ match, entry }: { match: MatchView; entry: DraftView }) {
	const { options, present, mine } = useDraftSession();
	const { t } = useTranslation();
	const start = match.facts[0];
	const last = match.facts.at(-1);
	const end = last?.type === "match.ended" ? last : undefined;
	const player = usePlayback(end?.duration ?? 0);
	const [panel, setPanel] = useState<"map" | "faceToFace">("map");
	const index = player.ended
		? match.snapshots.length - 1
		: Math.floor(player.second / 60);
	const snapshot = match.snapshots[index];
	if (start?.type !== "match.started" || !end || !snapshot) return null;
	const names = {
		blue: teamName(options, start.blue),
		red: teamName(options, start.red),
	};
	// On reopening a played game the series score already includes this win.
	const wins: [number, number] = [...entry.wins];
	if (entry.phase !== "result") wins[end.winner === mine ? 0 : 1]--;
	const score = {
		game: match.game,
		wins,
		blue: { team: start.blue },
		red: { team: start.red },
	};
	return (
		<>
			<PageHeader stage="match" score={score}>
				<div className="text-right">
					<p className="text-xs font-bold uppercase tracking-wider text-muted">
						{t("draft.match.clock")}
					</p>
					<time
						role="timer"
						aria-label={t("draft.match.clock")}
						className="text-[32px] font-bold leading-none tabular-nums"
					>
						{clockTime(player.second)}
					</time>
				</div>
			</PageHeader>
			<div className="match-layout">
				<TeamTotals snapshot={snapshot} names={names} ids={start} />
				<GoldChart
					snapshots={match.snapshots}
					index={index}
					names={names}
					duration={end.duration}
				/>
				<div className="match-map">
					{/* Both panes share one cell, so the row keeps its height. */}
					<div
						className="match-pane match-pane-map"
						hidden={panel !== "map"}
						inert={panel !== "map"}
					>
						<Structures
							snapshot={snapshot}
							second={player.second}
							names={names}
						/>
						<Objectives
							snapshot={snapshot}
							second={player.second}
							names={names}
						/>
					</div>
					<div
						className="match-pane"
						hidden={panel !== "faceToFace"}
						inert={panel !== "faceToFace"}
					>
						<FaceToFace snapshot={snapshot} names={names} />
					</div>
				</div>
				<EventFeed
					facts={match.facts}
					second={player.second}
					names={names}
					ended={player.ended}
				/>
			</div>
			<footer className="flex items-center gap-3 border-t border-line pt-3">
				<span className="text-muted">{t("draft.match.panel")}</span>
				<SegmentedControl
					label={t("draft.match.panel")}
					options={[
						{ value: "map", label: t("draft.match.panelMap") },
						{ value: "faceToFace", label: t("draft.match.faceToFace") },
					]}
					value={panel}
					onChange={setPanel}
				/>
				<span aria-hidden="true" className="h-5 border-l border-line" />
				{!player.ended && (
					<>
						<Button
							variant="ghost"
							className="border border-line"
							onClick={() => player.pause(!player.paused)}
						>
							{player.paused ? <Play size={16} /> : <Pause size={16} />}
							{t(player.paused ? "draft.match.resume" : "draft.match.pause")}
						</Button>
						<span className="text-muted">{t("draft.match.speed")}</span>
						<SegmentedControl
							label={t("draft.match.speed")}
							options={speeds.map((value) => ({
								value,
								label: (
									<>
										<span className="sr-only">
											{t("draft.match.multiplier", { value })}
										</span>
										<span
											aria-hidden="true"
											className="inline-flex items-center"
										>
											<X size={12} />
											{value}
										</span>
									</>
								),
							}))}
							value={player.speed}
							onChange={player.setSpeed}
						/>
					</>
				)}
				{player.ended ? (
					<IconButton
						className="ml-auto"
						variant="default"
						icon={ArrowRight}
						label={t("draft.match.result")}
						onClick={() => present("result")}
					/>
				) : (
					<Button className="ml-auto" onClick={player.skip}>
						{t("draft.match.skip")}
						<SkipForward size={17} />
					</Button>
				)}
			</footer>
		</>
	);
}

function RecordedGame({ entry }: { entry: DraftView }) {
	const { sessionId } = useDraftSession();
	const game = entry.phase === "side" ? entry.game - 1 : entry.game;
	const query = useCoreQuery<MatchView>(
		{ v: CONTRACT_VERSION, kind: "match.view", sessionId, params: { game } },
		{ affectedBy: () => false },
	);
	if (query.error) return <CoreErrorMessage error={query.error} />;
	return query.data ? <Replay match={query.data} entry={entry} /> : <Loading />;
}

function Loading() {
	const { t } = useTranslation();
	return <p role="status">{t("draft.match.loading")}</p>;
}

export function MatchScreen() {
	const { view, present, send } = useDraftSession();
	// Keep the pre-game score and game number when match.play advances the core.
	const [entry] = useState(view);
	const [ready, setReady] = useState(entry?.phase !== "result");
	const [failed, setFailed] = useState(false);
	const started = useRef(false);
	const { t } = useTranslation();
	useEffect(() => {
		if (!entry || ready || failed || started.current) return;
		started.current = true;
		present("match");
		void send("match.play", {}).then((ok) => {
			if (ok) setReady(true);
			else {
				started.current = false;
				setFailed(true);
			}
		});
	}, [entry, ready, failed, present, send]);
	if (!entry) return null;
	if (failed)
		return (
			<Button onClick={() => setFailed(false)}>{t("draft.match.retry")}</Button>
		);
	return ready ? <RecordedGame entry={entry} /> : <Loading />;
}
