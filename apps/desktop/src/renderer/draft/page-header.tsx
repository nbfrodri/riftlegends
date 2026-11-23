import type { DraftView } from "@rift-legends/contracts";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { teamName, useDraftSession } from "./session";
import type { DraftStage } from "./stages";
import { TeamCrest } from "./team-crest";

// The crest's fixed box, shrunk to the score's line. The match screen has its
// own crests in the team totals, so its score shows none.
const crest = "shrink-0 [&_img]:h-8 [&_img]:w-11 [&_svg]:h-8 [&_svg]:w-11";

type ScoreView = Pick<DraftView, "wins" | "game"> & {
	phase?: DraftView["phase"];
	blue: { team: string };
	red: { team: string };
};

function Score({ view, stage }: { view: ScoreView | null; stage: DraftStage }) {
	const { t } = useTranslation();
	const { options, mine } = useDraftSession();
	if (!view) return null;
	// In the side phase the core points to the next game but keeps the last draft.
	const showingResult = view.phase === "side" && stage === "result";
	const neutral = view.phase === "side" && !showingResult;
	const { blue, red } = view;
	const [left, right] =
		neutral && red.team === mine ? [red, blue] : [blue, red];
	const wins = (team: string) => view.wins[team === mine ? 0 : 1];
	return (
		<fieldset
			aria-label={t("draft.score.label")}
			className="m-0 grid min-w-0 border-0 p-0 grid-cols-[1fr_auto_1fr] items-center gap-x-3 text-center"
		>
			<span className="flex min-w-0 items-center justify-end gap-2 font-bold">
				<span className={`truncate ${neutral ? "" : "text-side-blue"}`}>
					{teamName(options, left.team)}
				</span>
				{stage !== "match" && (
					<span className={`${crest} ${neutral ? "" : "text-side-blue"}`}>
						<TeamCrest id={left.team} name={teamName(options, left.team)} />
					</span>
				)}
			</span>
			<b className="whitespace-nowrap font-display text-3xl">
				{wins(left.team)} – {wins(right.team)}
			</b>
			<span className="flex min-w-0 items-center gap-2 font-bold">
				{stage !== "match" && (
					<span className={`${crest} ${neutral ? "" : "text-side-red"}`}>
						<TeamCrest id={right.team} name={teamName(options, right.team)} />
					</span>
				)}
				<span className={`truncate ${neutral ? "" : "text-side-red"}`}>
					{teamName(options, right.team)}
				</span>
			</span>
			<small className="col-span-3 mt-1 text-muted">
				{t("draft.score.game", {
					game: showingResult ? view.game - 1 : view.game,
				})}
			</small>
		</fieldset>
	);
}

/** Breadcrumb, title and series score, as in the approved mockups. */
export function PageHeader({
	stage,
	score,
	children,
}: {
	stage: DraftStage;
	score?: ScoreView;
	children?: ReactNode;
}) {
	const { view } = useDraftSession();
	const { t } = useTranslation();
	return (
		<header
			className={
				stage === "match" ||
				stage === "draft" ||
				stage === "roles" ||
				stage === "side"
					? "grid grid-cols-[1fr_auto_1fr] items-center gap-4"
					: "flex items-center justify-between gap-4"
			}
		>
			<div>
				<nav aria-label={t("draft.crumb.label")}>
					<ol className="mb-1 flex items-center gap-2 text-[13px] text-muted">
						<li>{t("draft.crumb.root")}</li>
						<li aria-hidden="true">
							<ChevronRight className="size-3.5" />
						</li>
						<li aria-current="page">
							{stage === "match" && score
								? t("draft.score.game", { game: score.game })
								: t(`draft.stage.${stage}.crumb`)}
						</li>
					</ol>
				</nav>
				<h1
					className={`font-bold font-display leading-none tracking-heading ${stage === "match" ? "text-[clamp(32px,3vw,48px)]" : "text-[clamp(29px,2.5vw,48px)]"}`}
				>
					{stage === "match"
						? t("draft.match.title")
						: t(`draft.stage.${stage}.title`)}
				</h1>
			</div>
			<Score view={score ?? view} stage={stage} />
			{children}
		</header>
	);
}
