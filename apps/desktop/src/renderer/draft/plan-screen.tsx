import {
	CONTRACT_VERSION,
	type MatchPlan,
	type TeamStrategy,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import type { LucideIcon } from "lucide-react";
import {
	Crown,
	Dices,
	Flame,
	Gauge,
	Lightbulb,
	Play,
	Rabbit,
	Scale,
	ShieldCheck,
	Swords,
	Target,
	Turtle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapIcon } from "../assets/map-icon";
import { CoreErrorMessage, useCoreQuery } from "../core";
import { teamName, useDraftSession } from "./session";

/** The three levers, with each option's icon, in the order shown. */
const levers = [
	{
		lever: "tempo",
		icon: Gauge,
		options: [
			{
				value: "slow",
				icon: Turtle,
				label: "draft.plan.tempo.slow",
				hint: "draft.plan.tempo.slow.hint",
			},
			{
				value: "balanced",
				icon: Scale,
				label: "draft.plan.tempo.balanced",
				hint: "draft.plan.tempo.balanced.hint",
			},
			{
				value: "fast",
				icon: Rabbit,
				label: "draft.plan.tempo.fast",
				hint: "draft.plan.tempo.fast.hint",
			},
		],
	},
	{
		lever: "objectives",
		icon: Target,
		options: [
			{
				value: "dragon",
				icon: Flame,
				objective: "dragon",
				label: "draft.plan.objectives.dragon",
				hint: "draft.plan.objectives.dragon.hint",
			},
			{
				value: "balanced",
				icon: Scale,
				label: "draft.plan.objectives.balanced",
				hint: "draft.plan.objectives.balanced.hint",
			},
			{
				value: "baron",
				icon: Crown,
				objective: "baron",
				label: "draft.plan.objectives.baron",
				hint: "draft.plan.objectives.baron.hint",
			},
		],
	},
	{
		lever: "risk",
		icon: Swords,
		options: [
			{
				value: "safe",
				icon: ShieldCheck,
				label: "draft.plan.risk.safe",
				hint: "draft.plan.risk.safe.hint",
			},
			{
				value: "balanced",
				icon: Scale,
				label: "draft.plan.risk.balanced",
				hint: "draft.plan.risk.balanced.hint",
			},
			{
				value: "risky",
				icon: Dices,
				label: "draft.plan.risk.risky",
				hint: "draft.plan.risk.risky.hint",
			},
		],
	},
] as const;

function Option(props: {
	value: string;
	icon: LucideIcon;
	/** Shows the official objective icon, with `icon` as its fallback. */
	objective?: "dragon" | "baron" | undefined;
	label: string;
	hint: string;
	name: string;
	checked: boolean;
	suggested: boolean;
	onSelect: () => void;
}) {
	const { t } = useTranslation();
	const Icon = props.icon;
	return (
		<label className="press relative cursor-pointer">
			<input
				type="radio"
				name={props.name}
				value={props.value}
				checked={props.checked}
				onChange={props.onSelect}
				className="peer absolute size-px opacity-0"
			/>
			<span className="flex h-full flex-col gap-2 border border-line bg-panel p-[14px] hover:bg-surface outline-offset-[-2px] peer-checked:border-action peer-checked:bg-surface peer-checked:outline-2 peer-checked:outline-action peer-focus-visible:outline-3 peer-focus-visible:outline-action">
				<span className="flex items-center gap-2 font-bold">
					{props.objective ? (
						<MapIcon
							kind={props.objective}
							size="size-5"
							fallback={
								<Icon aria-hidden="true" className="size-5 text-action" />
							}
						/>
					) : (
						<Icon aria-hidden="true" className="size-5 text-action" />
					)}
					{props.label}
					{props.suggested && (
						<span className="ml-auto bg-action px-2 py-[2px] font-bold text-[12px] text-on-action">
							{t("draft.plan.suggested")}
						</span>
					)}
				</span>
				<span className="text-[14px] text-muted">{props.hint}</span>
			</span>
		</label>
	);
}

function PlanEditor({ plan }: { plan: MatchPlan }) {
	const { t, i18n } = useTranslation();
	const { options, mine, present, setStrategy } = useDraftSession();
	const [changes, setChanges] = useState<Partial<TeamStrategy>>({});
	const [playing, setPlaying] = useState(false);
	const strategy: TeamStrategy = { ...plan.strategy, ...changes };

	const reason = (cause: MatchPlan["causes"][number]) => {
		const key = `draft.plan.cause.${cause.key}.${cause.points > 0 ? "up" : "down"}`;
		return i18n.exists(key) ? t(key as never) : String(cause.key);
	};

	return (
		<>
			<header>
				<h2 className="font-bold font-display text-[27px] tracking-heading">
					{t("draft.plan.heading", { team: teamName(options, mine ?? "") })}
				</h2>
				<p className="mt-1 text-[14px] text-muted">{t("draft.plan.intro")}</p>
			</header>
			<div className="grid flex-1 content-start gap-5">
				{levers.map(({ lever, icon: Icon, options: choices }) => (
					<fieldset
						key={lever}
						aria-label={t(`draft.plan.${lever}`)}
						className="m-0 grid min-w-0 grid-cols-[minmax(180px,1fr)_3fr] items-stretch gap-x-6 border-0 p-0"
					>
						<div>
							<h3 className="flex items-center gap-2 font-bold font-display text-[18px]">
								<Icon aria-hidden="true" className="size-5 text-action" />
								{t(`draft.plan.${lever}`)}
							</h3>
							<p className="mt-1 text-[14px] text-muted">
								{t(`draft.plan.${lever}.hint`)}
							</p>
						</div>
						<div
							role="radiogroup"
							aria-label={t(`draft.plan.${lever}`)}
							className="grid grid-cols-3 gap-3"
						>
							{choices.map((choice) => (
								<Option
									key={choice.value}
									value={choice.value}
									icon={choice.icon}
									objective={
										"objective" in choice ? choice.objective : undefined
									}
									label={t(choice.label)}
									hint={t(choice.hint)}
									name={`plan-${lever}`}
									checked={strategy[lever] === choice.value}
									suggested={plan.strategy[lever] === choice.value}
									onSelect={() =>
										setChanges((current) => ({
											...current,
											[lever]: choice.value,
										}))
									}
								/>
							))}
						</div>
					</fieldset>
				))}
			</div>
			<footer className="flex items-start justify-between gap-6 border-line border-t pt-[14px]">
				<section className="max-w-[70ch] border-action border-l-[3px] bg-panel px-[18px] py-[13px]">
					<h3 className="flex items-center gap-2 font-bold">
						<Lightbulb aria-hidden="true" className="size-4 text-action" />
						{t("draft.plan.why")}
					</h3>
					{plan.causes.length > 0 ? (
						<ul className="mt-2 grid gap-1 text-[14px]">
							{plan.causes.map((cause) => (
								<li key={cause.key}>{reason(cause)}</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-[14px]">{t("draft.plan.noReasons")}</p>
					)}
				</section>
				<Button
					disabled={playing}
					onClick={() => {
						setPlaying(true);
						setStrategy(strategy);
						present("match");
					}}
				>
					{t("draft.plan.play")}
					<Play aria-hidden="true" className="size-4" />
				</Button>
			</footer>
		</>
	);
}

const noFact = () => false;

/**
 * U12: the user's game plan before each game. The core's suggestion (from both
 * drafts) is preselected and explained; «Play» hands the choice to the match
 * screen, which sends it with `match.play`. The rival's plan is not shown.
 */
export function PlanScreen() {
	const { sessionId, view, mine } = useDraftSession();
	const query = useCoreQuery<MatchPlan>(
		{ v: CONTRACT_VERSION, kind: "match.plan", sessionId, params: {} },
		{ affectedBy: noFact },
	);
	if (view?.phase !== "result" || !mine) return null;
	if (query.error) return <CoreErrorMessage error={query.error} />;
	if (!query.data) return null;
	return <PlanEditor key={`${query.data.game}`} plan={query.data} />;
}
