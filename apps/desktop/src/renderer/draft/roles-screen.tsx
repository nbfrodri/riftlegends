import { ROLES, type Role } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { ArrowLeftRight, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { ChampionPortrait } from "./champion-portrait";
import { CountryFlag } from "./country-flag";
import { type Lineup, suggestRoles } from "./roles-proposal";
import { championLabel, teamName, useDraftSession } from "./session";

type Assignment = Record<string, Role>;

const toAssignment = (lineup: Lineup) =>
	Object.fromEntries(ROLES.map((role) => [lineup[role], role])) as Assignment;

function list(language: string, items: string[]) {
	return new Intl.ListFormat(language, {
		style: "long",
		type: "conjunction",
	}).format(items);
}

function LineupEditor(props: { picks: string[]; sideColor: string }) {
	const { t, i18n } = useTranslation();
	const { options, mine, send, view } = useDraftSession();
	const suggestion = suggestRoles(props.picks, options.positions);
	const [assignment, setAssignment] = useState(() => toAssignment(suggestion));
	// The cards keep the order of the first suggestion, so they do not jump.
	const [order] = useState(() => ROLES.map((role) => suggestion[role]));
	const [pending, setPending] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const starters = options.teams.find((team) => team.id === mine)?.players;

	const roleLabel = (role: Role) => t(`draft.roles.role.${role}`);
	const items = ROLES.map((role) => ({ value: role, label: roleLabel(role) }));
	const taken = order.map((champion) => assignment[champion] as Role);
	const repeated = ROLES.filter(
		(role) => taken.filter((r) => r === role).length > 1,
	);
	const missing = ROLES.filter((role) => !taken.includes(role));
	const valid = repeated.length === 0 && missing.length === 0;

	const swap = (champion: string) => {
		if (pending === null) return setPending(champion);
		if (pending !== champion)
			setAssignment((current) => ({
				...current,
				[pending]: current[champion] as Role,
				[champion]: current[pending] as Role,
			}));
		setPending(null);
	};

	const confirm = async () => {
		if (!valid || !mine) return;
		setSending(true);
		const roles = Object.fromEntries(
			order.map((champion) => [assignment[champion], champion]),
		);
		if (!(await send("draft.roles", { team: mine, roles }))) setSending(false);
	};

	const names = (roles: Role[]) => list(i18n.language, roles.map(roleLabel));
	const note = pending
		? t("draft.roles.swapWith")
		: valid
			? t("draft.roles.ready")
			: [
					repeated.length > 0 &&
						t("draft.roles.repeated", { roles: names(repeated) }),
					missing.length > 0 &&
						t("draft.roles.missing", { roles: names(missing) }),
				]
					.filter(Boolean)
					.join(" ");

	return (
		<>
			<section className="flex flex-1 flex-col">
				<header className="flex items-end justify-between gap-4">
					<div>
						<p className="text-[13px] text-muted">
							{t(
								`draft.roles.side.${view?.blue.team === mine ? "blue" : "red"}`,
							)}
						</p>
						<h2 className="mt-1 font-bold font-display text-[27px] tracking-heading">
							{t("draft.roles.lineup", { team: teamName(options, mine ?? "") })}
						</h2>
					</div>
					<Button
						variant="ghost"
						onClick={() => {
							setAssignment(toAssignment(suggestion));
							setPending(null);
						}}
					>
						<RotateCcw aria-hidden="true" className="size-4" />
						{t("draft.roles.restore")}
					</Button>
				</header>
				<div className="mt-5 grid flex-1 grid-cols-5 gap-3">
					{order.map((champion) => {
						const role = assignment[champion] as Role;
						const conflict = repeated.includes(role);
						const name = championLabel(options, champion);
						const player = starters?.find((starter) => starter.role === role);
						return (
							<article
								key={champion}
								aria-label={name}
								className={`flex min-w-0 flex-col border-t-[3px] bg-panel p-[11px] ${conflict ? "border-side-red" : props.sideColor}`}
							>
								<header className="flex items-center gap-[7px] text-action">
									<GameRoleIcon role={role} />
									<b>{roleLabel(role)}</b>
								</header>
								<ChampionPortrait id={champion} size="role" />
								<h3 className="truncate font-bold font-display text-[clamp(13px,1.15vw,18px)] tracking-[-0.04em]">
									{name}
								</h3>
								{player && (
									<p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
										<CountryFlag country={player.nationality} />
										<Tooltip content={player.handle}>
											<span className="truncate">{player.handle}</span>
										</Tooltip>
									</p>
								)}
								<div className="mt-[10px] flex flex-col gap-[7px]">
									<Select
										items={items}
										value={role}
										onValueChange={(value) =>
											value &&
											setAssignment((current) => ({
												...current,
												[champion]: value as Role,
											}))
										}
									>
										<SelectTrigger
											aria-label={t("draft.roles.roleOf", { champion: name })}
											aria-invalid={conflict}
											className={`w-full ${conflict ? "border-side-red" : ""}`}
										>
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
									<Button
										variant="ghost"
										aria-pressed={pending === champion}
										aria-label={t("draft.roles.swapOf", { champion: name })}
										className={`w-full ${pending === champion ? "border border-action text-action" : ""}`}
										onClick={() => swap(champion)}
									>
										<ArrowLeftRight aria-hidden="true" className="size-4" />
										{t("draft.roles.swap")}
									</Button>
								</div>
							</article>
						);
					})}
				</div>
			</section>
			<footer className="flex items-center justify-between gap-4 border-line border-t pt-[14px]">
				<div
					role="status"
					className={`border-l-[3px] bg-panel px-[18px] py-[13px] ${valid ? "border-side-blue" : "border-side-red"}`}
				>
					<strong className={valid ? "text-side-blue" : "text-side-red"}>
						{valid ? t("draft.roles.valid") : t("draft.roles.invalid")}
					</strong>
					<p className="mt-1 text-[14px]">{note}</p>
				</div>
				<Button disabled={!valid || sending} onClick={() => void confirm()}>
					{t("draft.roles.confirm")}
					<Check aria-hidden="true" className="size-4" />
				</Button>
			</footer>
		</>
	);
}

/**
 * U7: the user's five picks, each in a role. The screen proposes the most
 * plausible lineup and lets the user change it; the core only receives a
 * lineup with every role once.
 */
export function RolesScreen() {
	const { t } = useTranslation();
	const { view, options, mine } = useDraftSession();
	if (view?.phase !== "roles" || !mine) return null;

	const turn = view.turn;
	if (!turn || turn.team !== mine) {
		const rival = view.blue.team === mine ? view.red.team : view.blue.team;
		return (
			<p role="status" className="text-muted">
				{t("draft.roles.rivalAssigning", { team: teamName(options, rival) })}
			</p>
		);
	}

	const mineIsBlue = view.blue.team === mine;
	const picks = (mineIsBlue ? view.blue : view.red).picks;
	return (
		<LineupEditor
			picks={picks}
			sideColor={mineIsBlue ? "border-side-blue" : "border-side-red"}
		/>
	);
}
