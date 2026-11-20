import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { pacing } from "./pacing";
import type { createSweep } from "./sweep";
import "./draft.css";

type Phase = "ban" | "countdown" | "locked";
const turnSeconds = 8;

function Tower({ side, phase }: { side: "blue" | "red"; phase: Phase }) {
	const { t } = useTranslation();
	const blue = side === "blue";
	const names = blue
		? ["Talvo", "Irial", "Oriel", phase === "locked" ? "Veyra" : "", ""]
		: ["Erda", "Solven", "Mirel", "Voln", ""];
	const bans = blue
		? ["Silex", "Etra"]
		: ["Ovra", ...(phase === "ban" ? [] : ["Nimbo"])];
	const roles = ["top", "jungle", "bot", "mid", "support"] as const;
	return (
		<section className={`tower ${side}`}>
			<small>{t(`draft.${side}`)}</small>
			<h2>{t(blue ? "draft.blueTeam" : "draft.redTeam")}</h2>
			<ol>
				{roles.map((role, i) => (
					<li
						key={role}
						className={blue && i === 3 && phase !== "ban" ? "current-pick" : ""}
					>
						<span className="pick-index">
							{blue ? "B" : "R"}
							{i + 1}
						</span>
						<span className="pick-sigil" aria-hidden="true">
							{["◇", "◈", "△", "◒", "⬡"][i]}
						</span>
						<span>
							<strong>{names[i] || t("draft.pending")}</strong>
							<small>{t(`market.role.${role}`)}</small>
						</span>
					</li>
				))}
			</ol>
			<small>{t("draft.bans")}</small>
			<div className="ban-strip">
				{bans.map((name) => (
					<s key={name}>{name}</s>
				))}
			</div>
		</section>
	);
}

export function DraftScreen() {
	const { t } = useTranslation();
	const [phase, setPhase] = useState<Phase>("ban");
	const [seconds, setSeconds] = useState(turnSeconds);
	const [reduced, setReduced] = useState(
		() => matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const [gpu, setGpu] = useState("loading");
	const canvas = useRef<HTMLCanvasElement>(null);
	const effect = useRef<Awaited<ReturnType<typeof createSweep>> | null>(null);
	useEffect(() => {
		const media = matchMedia("(prefers-reduced-motion: reduce)");
		const change = () => setReduced(media.matches);
		media.addEventListener("change", change);
		return () => media.removeEventListener("change", change);
	}, []);
	useEffect(() => {
		const element = canvas.current;
		if (!element || typeof WebGL2RenderingContext === "undefined") {
			setGpu("unavailable");
			return;
		}
		let disposed = false;
		import("./sweep")
			.then(({ createSweep }) => createSweep(element))
			.then((layer) => {
				if (disposed) return layer.destroy();
				effect.current = layer;
				setGpu("webgl2");
			})
			.catch((error) => {
				console.error("Draft sweep", error);
				if (!disposed) setGpu("unavailable");
			});
		return () => {
			disposed = true;
			effect.current?.destroy();
			effect.current = null;
		};
	}, []);
	useEffect(() => {
		if (phase !== "countdown") return;
		const deadline = performance.now() + turnSeconds * 1000;
		const timer = window.setInterval(() => {
			const left = Math.max(
				0,
				Math.ceil((deadline - performance.now()) / 1000),
			);
			setSeconds(left);
			if (left === 0) setPhase("locked");
		}, 100);
		return () => clearInterval(timer);
	}, [phase]);
	useEffect(() => {
		if (phase === "locked" && !reduced) effect.current?.play();
	}, [phase, reduced]);

	function advance() {
		if (phase === "locked") {
			setSeconds(turnSeconds);
			setPhase("ban");
		} else setPhase(phase === "ban" ? "countdown" : "locked");
	}
	const action = {
		ban: "banAction",
		countdown: "confirmAction",
		locked: "resetAction",
	} as const;
	const index = phase === "ban" ? "R2" : "B4";
	return (
		<div className="broadcast" data-phase={phase}>
			<header className="broadcast-head">
				<div>
					<h1>{t("shell.nav.draft")}</h1>
					<small>{t("draft.series")}</small>
				</div>
				<div className="series-score">
					{t("draft.blueTeam")} <b>1 – 1</b> {t("draft.redTeam")}
				</div>
				<div className="turn-clock">
					<small>{t("draft.time")}</small>
					<time>
						{phase === "ban" ? "—" : `00:${String(seconds).padStart(2, "0")}`}
					</time>
				</div>
			</header>
			<div className="broadcast-board">
				<Tower side="blue" phase={phase} />
				<section className="hero-plate">
					<div className="signal">
						<span className="turn-index">{index}</span>
					</div>
					<div className="hero-caption">
						<small>{t(`draft.${phase}`)}</small>
						<h2>{phase === "ban" ? "Nimbo" : "Veyra"}</h2>
						<p>{t("market.role.mid")}</p>
						<button type="button" onClick={advance}>
							{t(`draft.${action[phase]}`)}
						</button>
					</div>
					<div
						className="closure"
						role="status"
						aria-live="polite"
						aria-atomic="true"
					>
						{phase === "locked" &&
							(reduced ? (
								<strong>{t("draft.announcement")}</strong>
							) : (
								<motion.strong
									initial={{ opacity: 0, transform: "translateY(8px)" }}
									animate={{ opacity: 1, transform: "translateY(0px)" }}
									transition={{
										delay: pacing.labelDelayMs / 1000,
										duration: pacing.labelEnterMs / 1000,
										ease: pacing.ease,
									}}
								>
									{t("draft.announcement")}
								</motion.strong>
							))}
					</div>
					<canvas
						ref={canvas}
						data-renderer={gpu}
						className="sweep-layer"
						inert
						hidden={phase !== "locked" || reduced}
					/>
					{gpu === "unavailable" && <small>{t("draft.noEffect")}</small>}
				</section>
				<Tower side="red" phase={phase} />
			</div>
		</div>
	);
}
