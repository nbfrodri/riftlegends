import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { animate } from "motion/mini";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { championLabel, teamName, useDraftSession } from "../session";
import { pacing } from "./pacing";

function Sweep({ position }: { position: number | undefined }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const track = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = canvas.current;
		if (!element || typeof WebGL2RenderingContext === "undefined") return;
		let disposed = false;
		let destroy: (() => void) | undefined;
		void import("./sweep")
			.then(async ({ drawSweep }) => {
				if (disposed) return;
				destroy = await drawSweep(element);
				if (disposed) destroy?.();
			})
			.catch((error) => console.warn("Draft sweep unavailable", error));
		return () => {
			disposed = true;
			destroy?.();
		};
	}, []);
	useLayoutEffect(() => {
		if (position === undefined || !track.current?.animate) return;
		const sweep = animate(
			[track.current],
			{ transform: ["translateX(-35%)", "translateX(100%)"] },
			{
				duration: pacing.sweepMs / 1000,
				ease: pacing.ease,
			},
		);
		return () => sweep.complete();
	}, [position]);
	return (
		<div
			ref={track}
			aria-hidden="true"
			className="pointer-events-none absolute inset-0"
			style={{ transform: "translateX(100%)" }}
		>
			<canvas ref={canvas} className="h-full w-1/3" />
		</div>
	);
}

export function BroadcastScene() {
	const { lock, options, view } = useDraftSession();
	const reduced = useReducedMotion();
	const { t } = useTranslation();
	const caption = useRef<HTMLSpanElement>(null);
	const current = lock?.game === view?.game ? lock : null;
	useLayoutEffect(() => {
		if (!current || reduced || !caption.current?.animate) return;
		const entrance = animate(
			[caption.current],
			{ opacity: [0, 1], transform: ["translateY(8px)", "translateY(0px)"] },
			{
				delay: pacing.captionDelayMs / 1000,
				duration: pacing.captionEnterMs / 1000,
				ease: pacing.ease,
			},
		);
		return () => entrance.complete();
	}, [current, reduced]);
	const team = current ? teamName(options, current.team) : "";
	const champion = current?.champion
		? championLabel(options, current.champion)
		: "";
	const message = !current
		? ""
		: t(
				current.champion
					? `draft.broadcast.${current.action}`
					: "draft.broadcast.skip",
				{ team, champion },
			);
	return (
		<>
			{view?.first && view.phase !== "roles" && (
				<small
					className={view.first === "blue" ? "text-side-blue" : "text-side-red"}
				>
					{t("draft.broadcast.first", {
						side: t(`draft.side.column.${view.first}`),
					})}
				</small>
			)}
			<div
				data-draft-lock={current?.position}
				className={`relative min-w-0 overflow-hidden ${current ? "border-l-2 bg-panel px-3 py-1" : "w-0"} ${current?.team === view?.blue.team ? "border-side-blue" : "border-side-red"}`}
			>
				<span
					role="status"
					aria-label={t("draft.broadcast.label")}
					aria-atomic="true"
					className="sr-only"
				>
					{message}
				</span>
				{current && (
					<div aria-hidden="true" className="grid">
						<strong className="truncate font-display text-lg leading-tight">
							{champion || team}
						</strong>
						<span
							key={`${current.position}-${reduced}`}
							ref={caption}
							className="text-xs text-muted"
						>
							{current.champion
								? t(`draft.broadcast.caption.${current.action}`, { team })
								: t("draft.broadcast.noBan")}
						</span>
					</div>
				)}
				{!reduced && <Sweep position={current?.position} />}
			</div>
		</>
	);
}
