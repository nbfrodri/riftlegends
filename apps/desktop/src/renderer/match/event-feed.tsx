import type { MatchEvent, MatchView } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { animate as fade } from "motion/mini";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clockTime } from "./playback";
import type { TeamNames } from "./scoreboard";

const when = (e: MatchEvent) => (e.minute - 1) * 60 + e.second;

const EventRow = memo(function EventRow({
	event,
	team,
	animate,
}: {
	event: MatchEvent;
	team: string;
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
		<li ref={row} data-side={event.side}>
			<time>{clockTime(when(event))}</time>
			<div>
				<p className="match-event-meta">
					{t("draft.match.location", {
						team,
						zone: t(`draft.match.zone.${event.zone}`),
					})}
				</p>
				<h3>{t(`draft.match.kind.${event.kind}`)}</h3>
				{causes.length > 2 ? (
					<details>
						<summary>{summary}</summary>
						<p>{explain(causes.slice(2))}</p>
					</details>
				) : (
					<p>{summary}</p>
				)}
			</div>
		</li>
	);
});

export function EventFeed({
	facts,
	second,
	names,
	ended,
}: {
	facts: MatchView["facts"];
	second: number;
	names: TeamNames;
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
		<section className="match-feed match-panel">
			<h2>{t("draft.match.events")}</h2>
			<div className="match-feed-scroll">
				{count === 0 && (
					<p className="match-empty">{t("draft.match.noEvents")}</p>
				)}
				<ol aria-label={t("draft.match.events")}>
					{count > 0 &&
						events
							.slice(first, first + limit)
							.map(({ event, index }) => (
								<EventRow
									key={index}
									event={event}
									team={names[event.side]}
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
