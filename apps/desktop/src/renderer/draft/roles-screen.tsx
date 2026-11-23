import {
	type DraftView,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { ChampionPortrait } from "./champion-portrait";
import { CountryFlag } from "./country-flag";
import { championLabel, teamName, useDraftSession } from "./session";

function TeamLineup(props: {
	side: Side;
	team: string;
	champions: readonly string[];
	pending?: Role | null;
	onSwap?: (role: Role) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const title = useId();
	const players = options.teams.find((team) => team.id === props.team)?.players;
	const blue = props.side === "blue";
	return (
		<section
			aria-labelledby={title}
			className={`min-w-0 border-t-[3px] bg-panel p-3 ${blue ? "border-side-blue" : "border-side-red"}`}
		>
			<p
				className={`text-xs font-semibold uppercase ${blue ? "text-side-blue" : "text-side-red"}`}
			>
				{t(`draft.roles.side.${props.side}`)}
			</p>
			<h2
				id={title}
				className="mb-2 truncate font-display text-2xl font-bold tracking-heading"
			>
				{t("draft.roles.lineup", { team: teamName(options, props.team) })}
			</h2>
			{ROLES.map((role, i) => {
				const player = players?.find((player) => player.role === role);
				const champion = props.champions[i];
				if (!champion) return null;
				const name = championLabel(options, champion);
				const roleName = t(`draft.roles.role.${role}`);
				const selected = role === props.pending;
				return (
					<article
						key={role}
						aria-label={`${roleName} · ${player?.handle ?? ""}`}
						className={`flex items-center gap-3 border-line border-t py-1.5 px-1 ${selected ? "bg-action/10 ring-1 ring-inset ring-action" : ""}`}
					>
						<div className="size-[clamp(48px,7.5vh,84px)] shrink-0">
							<ChampionPortrait id={champion} size="tile" label={name} />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5 text-xs text-muted">
								<GameRoleIcon role={role} size={16} />
								{roleName}
							</div>
							<div className="flex items-center gap-1.5">
								<CountryFlag country={player?.nationality} />
								<strong className="truncate font-display text-lg leading-tight">
									{player?.handle}
								</strong>
							</div>
							<p className="truncate text-sm text-muted">{name}</p>
						</div>
						{props.onSwap && (
							<Button
								variant="ghost"
								aria-pressed={selected}
								aria-label={t("draft.roles.swapOf", { champion: name })}
								disabled={props.disabled}
								onClick={() => props.onSwap?.(role)}
							>
								{t("draft.roles.swap")}
							</Button>
						)}
					</article>
				);
			})}
		</section>
	);
}

function LineupEditor({ view, side }: { view: DraftView; side: Side }) {
	const { t } = useTranslation();
	const { send } = useDraftSession();
	const [picks, setPicks] = useState(view[side].picks);
	const [pending, setPending] = useState<Role | null>(null);
	const [sending, setSending] = useState(false);
	const rival = side === "blue" ? "red" : "blue";
	const assigned = view[rival].roles;

	const swap = (role: Role) => {
		if (!pending) return setPending(role);
		const a = ROLES.indexOf(pending);
		const b = ROLES.indexOf(role);
		setPicks((current) => {
			const next = [...current];
			[next[a], next[b]] = [current[b] as string, current[a] as string];
			return next;
		});
		setPending(null);
	};

	const confirm = async () => {
		setSending(true);
		const roles = Object.fromEntries(ROLES.map((role, i) => [role, picks[i]]));
		if (!(await send("draft.roles", { team: view[side].team, roles })))
			setSending(false);
	};

	return (
		<>
			<div className="grid grid-cols-2 items-start gap-3">
				<TeamLineup
					side={side}
					team={view[side].team}
					champions={picks}
					pending={pending}
					onSwap={swap}
					disabled={sending}
				/>
				{assigned && (
					<TeamLineup
						side={rival}
						team={view[rival].team}
						champions={ROLES.map((role) => assigned[role])}
					/>
				)}
			</div>
			<footer className="flex items-center justify-between gap-4 border-line border-t pt-3">
				<p role="status" className="text-sm text-muted">
					{t(pending ? "draft.roles.swapWith" : "draft.roles.ready")}
				</p>
				<Button disabled={sending} onClick={() => void confirm()}>
					<Check aria-hidden="true" className="size-4" />
					{t("draft.roles.confirm")}
				</Button>
			</footer>
		</>
	);
}

export function RolesScreen() {
	const { t } = useTranslation();
	const { view, options, mine } = useDraftSession();
	if (view?.phase !== "roles" || !mine) return null;
	const side = view.blue.team === mine ? "blue" : "red";
	if (view.turn?.team !== mine) {
		const rival = view[side === "blue" ? "red" : "blue"].team;
		return (
			<p role="status" className="text-muted">
				{t("draft.roles.rivalAssigning", { team: teamName(options, rival) })}
			</p>
		);
	}
	return <LineupEditor key={view.game} side={side} view={view} />;
}
