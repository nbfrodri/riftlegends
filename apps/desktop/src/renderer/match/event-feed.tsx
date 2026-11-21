import type { MatchEvent, MatchView } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { animate as fade } from "motion/mini";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { panelTitle } from "./classes";
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
		<li
			ref={row}
			data-side={event.side}
			className="grid min-h-[clamp(78px,12vh,120px)] grid-cols-[auto_1fr] content-center gap-3.5 border-line border-t py-[9px]"
		>
			<time className="font-bold text-(--side) text-[16px]">
				{clockTime(when(event))}
			</time>
			<div>
				<p className="font-bold text-(--side) text-[11px] uppercase tracking-[0.04em]">
					{t("draft.match.location", {
						team,
						zone: t(`draft.match.zone.${event.zone}`),
					})}
				</p>
				<h3 className="my-0.5 font-bold text-[16px]">
					{t(`draft.match.kind.${event.kind}`)}
				</h3>
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
		// Size the map row from its tables; earlier events scroll inside this panel.
		<section className="flex min-h-0 min-w-0 flex-col bg-panel p-[clamp(12px,1.3vw,20px)] [contain:size]">
			<h2 className={`${panelTitle} mb-3`}>{t("draft.match.events")}</h2>
			<div className="h-0 min-h-0 flex-1 overflow-auto [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
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
