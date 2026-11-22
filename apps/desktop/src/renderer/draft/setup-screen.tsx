import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDraftSession } from "./session";
import { TeamCrest } from "./team-crest";

const FORMATS = ["bo1", "bo3", "bo5"] as const;
const FEARLESS = ["hard", "soft", "off"] as const;
const TIMER = ["off", "on"] as const;

type Format = (typeof FORMATS)[number];
type Fearless = (typeof FEARLESS)[number];
type Timer = (typeof TIMER)[number];

function Rule(props: {
	title: string;
	note: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-line border-t py-[clamp(12px,2vh,19px)]">
			<div>
				<h3 className="font-semibold">{props.title}</h3>
				<p className="mt-1 text-[13px] text-muted">{props.note}</p>
			</div>
			{props.children}
		</div>
	);
}

function TeamCard(props: {
	label: string;
	team: { id: string; name: string };
	teams: readonly { id: string; name: string }[];
	onChange: (id: string) => void;
	side: "blue" | "red";
}) {
	const { t } = useTranslation();
	const items = props.teams.map((team) => ({
		value: team.id,
		label: team.name,
	}));
	const color = props.side === "blue" ? "text-side-blue" : "text-side-red";
	const border = props.side === "blue" ? "border-side-blue" : "border-side-red";
	return (
		<section className={`border-t-[3px] bg-panel ${border}`}>
			<div
				className={`flex h-[clamp(110px,17vh,150px)] items-center justify-between bg-panel px-6 py-[18px] ${color}`}
			>
				<div>
					<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
						{props.label}
					</p>
					<h2 className="mt-1 font-bold font-display text-[42px] text-text leading-none tracking-team">
						{props.team.name}
					</h2>
				</div>
				<TeamCrest id={props.team.id} name={props.team.name} />
			</div>
			<div className="flex items-center justify-between border-line border-t px-5 py-[10px]">
				<span>{t("draft.setup.club")}</span>
				<Select
					items={items}
					value={props.team.id}
					onValueChange={(value) => value && props.onChange(value)}
				>
					<SelectTrigger aria-label={props.label} className="min-w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</section>
	);
}

/** U1: teams, format, fearless and timer. The rival's coach is information only. */
export function SetupScreen() {
	const { t, i18n } = useTranslation();
	const { options, send, setMine } = useDraftSession();
	const [first, second] = options.teams;
	const [mineId, setMineId] = useState(first?.id);
	const [rivalId, setRivalId] = useState(second?.id);
	const [format, setFormat] = useState<Format>("bo3");
	const [fearless, setFearless] = useState<Fearless>("hard");
	const [timer, setTimer] = useState<Timer>("off");
	const [starting, setStarting] = useState(false);

	const mine = options.teams.find((team) => team.id === mineId);
	const rival = options.teams.find((team) => team.id === rivalId);
	if (!mine || !rival) return null;

	// A team cannot face itself: taking the rival's team gives it mine.
	const chooseMine = (id: string) => {
		if (id === rival.id) setRivalId(mine.id);
		setMineId(id);
	};
	const chooseRival = (id: string) => {
		if (id === mine.id) setMineId(rival.id);
		setRivalId(id);
	};

	const coach = rival.coach;
	const level = new Intl.NumberFormat(i18n.language, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format((coach?.rating ?? 0) / 10);
	const personality = coach?.personality ?? "balanced";

	async function start() {
		if (!mine || !rival) return;
		setStarting(true);
		const ok = await send("series.start", {
			teams: [mine.id, rival.id],
			seeds: [mine.seed, rival.seed],
			format,
			fearless,
			timer: timer === "on",
			pool: options.pool,
			seed: crypto.getRandomValues(new Uint32Array(1))[0],
			ai: [null, "coach"],
		});
		if (ok) setMine(mine.id);
		else setStarting(false);
	}

	return (
		<>
			<div className="grid grid-cols-2 gap-gap">
				<TeamCard
					label={t("draft.setup.myTeam")}
					team={mine}
					teams={options.teams}
					onChange={chooseMine}
					side="blue"
				/>
				<TeamCard
					label={t("draft.setup.rivalTeam")}
					team={rival}
					teams={options.teams}
					onChange={chooseRival}
					side="red"
				/>
			</div>
			<div className="grid grid-cols-[1.6fr_1fr] gap-gap">
				<section className="bg-panel p-[clamp(16px,1.65vw,26px)]">
					<h2 className="mb-[13px] font-bold font-display text-xl tracking-heading">
						{t("draft.setup.rules")}
					</h2>
					<Rule
						title={t("draft.setup.format")}
						note={t("draft.setup.formatNote")}
					>
						<SegmentedControl
							label={t("draft.setup.format")}
							options={FORMATS.map((value) => ({
								value,
								label: t(`draft.setup.format.${value}`),
							}))}
							value={format}
							onChange={setFormat}
						/>
					</Rule>
					<Rule
						title={t("draft.setup.fearless")}
						note={t(`draft.setup.fearlessNote.${fearless}`)}
					>
						<SegmentedControl
							label={t("draft.setup.fearless")}
							options={FEARLESS.map((value) => ({
								value,
								label: t(`draft.setup.fearless.${value}`),
							}))}
							value={fearless}
							onChange={setFearless}
						/>
					</Rule>
					<Rule
						title={t("draft.setup.timer")}
						note={t("draft.setup.timerNote")}
					>
						<SegmentedControl
							label={t("draft.setup.timer")}
							options={TIMER.map((value) => ({
								value,
								label: t(`draft.setup.timer.${value}`),
							}))}
							value={timer}
							onChange={setTimer}
						/>
					</Rule>
				</section>
				<aside
					aria-label={t("draft.coach.label")}
					className="bg-panel p-[clamp(16px,1.65vw,26px)]"
				>
					<p className="font-semibold text-[12px] text-muted uppercase tracking-[0.055em]">
						{t("draft.coach.label")}
					</p>
					<h2 className="mt-[7px] mb-1 font-bold font-display text-[30px] leading-tight tracking-heading">
						{coach?.name ?? t("draft.coach.none")}
					</h2>
					<p className="text-muted">
						{t("draft.coach.of", { team: rival.name })}
					</p>
					<dl className="my-[14px] space-y-1.5 border-line border-y py-[11px]">
						<div className="flex items-baseline justify-between gap-1">
							<dt className="text-muted">{t("draft.coach.personality")}</dt>
							<dd className="font-semibold">
								{t(`draft.personality.${personality}.name`)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-1">
							<dt className="text-muted">{t("draft.coach.level")}</dt>
							<dd className="font-semibold">
								{t("draft.coach.levelValue", { value: level })}
							</dd>
						</div>
					</dl>
					<p>{t(`draft.personality.${personality}.note`)}</p>
				</aside>
			</div>
			<footer className="mt-auto flex items-center justify-between gap-4 border-line border-t pt-[14px] text-muted">
				<span>{t("draft.setup.seedingNote")}</span>
				<Button disabled={starting} onClick={() => void start()}>
					{t("draft.setup.start")}
					<ArrowRight aria-hidden="true" className="size-4" />
				</Button>
			</footer>
		</>
	);
}
