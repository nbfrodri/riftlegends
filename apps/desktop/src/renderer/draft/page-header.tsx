import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { teamName, useDraftSession } from "./session";
import type { DraftStage } from "./stages";

function Score() {
	const { t } = useTranslation();
	const { view, options, mine } = useDraftSession();
	if (!view) return null;
	const wins = (team: string) => view.wins[team === mine ? 0 : 1];
	const sides = [
		{ team: view.blue.team, color: "text-side-blue" },
		{ team: view.red.team, color: "text-side-red" },
	];
	return (
		<fieldset
			aria-label={t("draft.score.label")}
			className="m-0 grid min-w-0 border-0 p-0 grid-cols-[1fr_auto_auto_1fr] items-center gap-x-3 text-center"
		>
			<span className={`font-bold ${sides[0]?.color}`}>
				{teamName(options, view.blue.team)}
			</span>
			<b className="font-display text-3xl">{wins(view.blue.team)}</b>
			<b className="font-display text-3xl">{wins(view.red.team)}</b>
			<span className={`font-bold ${sides[1]?.color}`}>
				{teamName(options, view.red.team)}
			</span>
			<small className="col-span-4 mt-1 text-muted">
				{t("draft.score.game", { game: view.game })}
			</small>
		</fieldset>
	);
}

/** Breadcrumb, title and series score, as in the approved mockups. */
export function PageHeader({ stage }: { stage: DraftStage }) {
	const { t } = useTranslation();
	return (
		<header className="flex items-center justify-between gap-4">
			<div>
				<nav aria-label={t("draft.crumb.label")}>
					<ol className="mb-1 flex items-center gap-2 text-[13px] text-muted">
						<li>{t("draft.crumb.root")}</li>
						<li aria-hidden="true">
							<ChevronRight className="size-3.5" />
						</li>
						<li aria-current="page">{t(`draft.stage.${stage}.crumb`)}</li>
					</ol>
				</nav>
				<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] leading-none tracking-heading">
					{t(`draft.stage.${stage}.title`)}
				</h1>
			</div>
			<Score />
		</header>
	);
}
