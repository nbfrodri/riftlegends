import type { MatchEvent, MatchView } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { animate as fade } from "motion/mini";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { isObjectiveKind, MapIcon } from "../assets/map-icon";
import { ChampionPortrait } from "../draft/champion-portrait";
import { TeamCrest } from "../draft/team-crest";
import { panelTitle } from "./classes";
import type { LanePlayer } from "./face-to-face";
import { clockTime } from "./playback";
import type { TeamNames } from "./scoreboard";

/** A player in the feed: who they are, what they play and in which role. */
export interface EventPlayer extends LanePlayer {
	role: "top" | "jungle" | "mid" | "bot" | "support";
}

/** Role icon, player handle and champion portrait; the handle is the name. */
function Participant({
	player,
	id,
}: {
	player: EventPlayer | undefined;
	id: string;
}) {
	const { t } = useTranslation();
	if (!player) return <b>{id}</b>;
	return (
		<span className="inline-flex items-center gap-1 align-middle">
			<GameRoleIcon
				role={player.role}
				size={16}
				label={t(`draft.roles.role.${player.role}`)}
			/>
			<ChampionPortrait
				id={player.champion}
				label={player.championName}
				size="compact"
			/>
			<b>{player.handle}</b>
		</span>
	);
}

const when = (e: MatchEvent) => (e.minute - 1) * 60 + e.second;

const EventRow = memo(function EventRow({
	event,
	team,
	teamId,
	players,
	animate,
}: {
	event: MatchEvent;
	team: string;
	teamId: string;
	players: ReadonlyMap<string, EventPlayer>;
	animate: boolean;
}) {
	const { t, i18n } = useTranslation();
	const row = useRef<HTMLLIElement>(null);
	useEffect(() => {
		if (!animate || !row.current) return;
		const entrance = fade(
			[row.current],
			{ opacity: [0, 1] },
			{ duration: 0.16 },
		);
		return () => entrance.complete();
	}, [animate]);
	const causes = [...event.causes].sort(
		(a, b) => Math.abs(b.points) - Math.abs(a.points),
	);
	const list = new Intl.ListFormat(i18n.language);
	const explain = (items: MatchEvent["causes"]) => {
		const groups: { favored: string[]; against: string[] } = {
			favored: [],
			against: [],
		};
		for (const { key, points } of items) {
			groups[points < 0 ? "against" : "favored"].push(
				t(`draft.match.cause.${key}`, { defaultValue: key }),
			);
		}
		return (["favored", "against"] as const)
			.filter((group) => groups[group].length > 0)
			.map((group) =>
				t(`draft.match.${group}`, { factor: list.format(groups[group]) }),
			)
			.join(" ");
	};
	const summary = explain(causes.slice(0, 2));
	return (
		<li
			ref={row}
			data-side={event.side}
			className="grid min-h-[clamp(78px,12vh,120px)] grid-cols-[auto_minmax(0,1fr)] content-center gap-3.5 border-line border-t py-[9px]"
		>
			<time className="font-bold text-(--side) text-[16px]">
				{clockTime(when(event))}
			</time>
			<div>
				<p className="flex items-center gap-1.5 font-bold text-(--side) text-[11px] uppercase tracking-[0.04em]">
					<span role="img" aria-label={team} className="flex">
						<TeamCrest
							id={teamId}
							name={team}
							className="h-[22px] w-[30px] object-contain"
						/>
					</span>
					{t(`draft.match.zone.${event.zone}`)}
				</p>
				<h3 className="my-0.5 flex items-center gap-1.5 font-bold text-[16px]">
					{isObjectiveKind(event.kind) && <MapIcon kind={event.kind} />}
					{t(`draft.match.kind.${event.kind}`)}
				</h3>
				{event.kills.map(({ killer, victim, assists, multikill }, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: kills retain the order recorded in the event.
						key={index}
						data-kill
					>
						<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
							<Participant player={players.get(killer)} id={killer} />
							{t("draft.match.killVerb")}
							<Participant player={players.get(victim)} id={victim} />
							{multikill && (
								<strong className="text-action">
									{t(`draft.match.multikill.${multikill}`)}
								</strong>
							)}
						</p>
						{assists.length > 0 && (
							<p
								data-assists
								className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]"
							>
								<span className="text-muted">
									{t("draft.match.assistedBy")}
								</span>
								{assists.map((player) => (
									<Participant
										key={player}
										player={players.get(player)}
										id={player}
									/>
								))}
							</p>
						)}
					</div>
				))}
				{causes.length > 2 ? (
					<details className="text-muted">
						<summary className="cursor-pointer">{summary}</summary>
						<p>{explain(causes.slice(2))}</p>
					</details>
				) : (
					<p className="text-muted">{summary}</p>
				)}
			</div>
		</li>
	);
});

export function EventFeed({
	facts,
	second,
	names,
	ids,
	players,
	ended,
}: {
	facts: MatchView["facts"];
	second: number;
	names: TeamNames;
	ids: TeamNames;
	players: ReadonlyMap<string, EventPlayer>;
	ended: boolean;
}) {
	const { t } = useTranslation();
	const [limit, setLimit] = useState(12);
	const events = useMemo(
		() =>
			facts
				.filter((f) => f.type === "match.event")
				.map((event, index) => ({ event, index, at: when(event) }))
				.sort((a, b) => b.at - a.at || b.index - a.index),
		[facts],
	);
	const first = events.findIndex((e) => e.at <= second);
	const count = first === -1 ? 0 : events.length - first;
	return (
		// Size the map row from its tables; earlier events scroll inside this panel.
		<section className="flex min-h-0 min-w-0 flex-col bg-panel p-(--pad) [--pad:clamp(12px,1.3vw,20px)] [contain:size]">
			<h2 className={`${panelTitle} mb-3`}>{t("draft.match.events")}</h2>
			<div className="h-0 min-h-0 flex-1 scroll-edge-(--pad)">
				{count === 0 && (
					<p className="border-line border-t pt-3.5 text-muted">
						{t("draft.match.noEvents")}
					</p>
				)}
				<ol aria-label={t("draft.match.events")} className="flex flex-col">
					{count > 0 &&
						events
							.slice(first, first + limit)
							.map(({ event, index }) => (
								<EventRow
									key={index}
									event={event}
									players={players}
									team={names[event.side]}
									teamId={ids[event.side]}
									animate={!ended}
								/>
							))}
				</ol>
				{count > limit && (
					<Button variant="ghost" onClick={() => setLimit((n) => n + 12)}>
						{t("draft.match.earlier")}
					</Button>
				)}
			</div>
		</section>
	);
}
