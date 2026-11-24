import {
	type DraftView,
	ROLES,
	type Role,
	type Side,
} from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { useReducedMotion } from "@rift-legends/ui-kit/lib/use-reduced-motion";
import { Check } from "lucide-react";
import { animate } from "motion/mini";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "../assets/game-role-icon";
import { PlayerPortrait } from "./board/player-card";
import { ChampionPortrait } from "./champion-portrait";
import { CountryFlag } from "./country-flag";
import { championLabel, teamName, useDraftSession } from "./session";

/** Portraits cross to their new rows when two champions swap (#432). */
const CROSS = { duration: 0.25, ease: [0.23, 1, 0.32, 1] } as const;

/** FLIP: each swapped portrait starts at the other's row and slides home. */
function useCrossSwap(swap: readonly [Role, Role] | null) {
	const reduced = useReducedMotion();
	const portraits = useRef(new Map<Role, HTMLElement>());
	useLayoutEffect(() => {
		const [a, b] = (swap ?? []).map((role) => portraits.current.get(role));
		if (reduced || !a || !b) return;
		const dy = b.getBoundingClientRect().top - a.getBoundingClientRect().top;
		const cross = [
			animate([a], { transform: [`translateY(${dy}px)`, "none"] }, CROSS),
			animate([b], { transform: [`translateY(${-dy}px)`, "none"] }, CROSS),
		];
		return () => {
			for (const animation of cross) animation.complete();
		};
	}, [swap, reduced]);
	return (role: Role) => (element: HTMLElement | null) => {
		if (element) portraits.current.set(role, element);
		else portraits.current.delete(role);
	};
}

function TeamLineup(props: {
	side: Side;
	team: string;
	champions: readonly string[];
	pending?: Role | null;
	onSwap?: (role: Role) => void;
	portrait?: (role: Role) => (element: HTMLElement | null) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation();
	const { options } = useDraftSession();
	const title = useId();
	const players = options.teams.find((team) => team.id === props.team)?.players;
	const blue = props.side === "blue";
	const reduced = useReducedMotion();
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
				const target = Boolean(props.pending) && !selected;
				const swap = props.pending
					? selected
						? "pending"
						: "target"
					: undefined;
				return (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the row's swap button is the keyboard path; the row click only widens the pointer target.
					<article
						key={role}
						aria-label={`${roleName} · ${player?.handle ?? ""}`}
						data-swap={swap}
						onClick={
							props.pending && !props.disabled
								? () => props.onSwap?.(role)
								: undefined
						}
						className={`flex items-center gap-3 border-line border-t py-1.5 px-1 transition-colors ${selected ? `bg-action/10 ring-2 ring-inset ring-action ${reduced ? "" : "swap-pulse"}` : ""} ${target ? "cursor-pointer hover:bg-action/5 hover:ring-1 hover:ring-inset hover:ring-action/60" : ""}`}
					>
						<div
							ref={props.portrait?.(role)}
							className="relative z-10 size-[clamp(48px,7.5vh,84px)] shrink-0"
						>
							<ChampionPortrait id={champion} size="tile" label={name} />
						</div>
						{player && (
							<PlayerPortrait
								id={player.id}
								handle={player.handle}
								size="h-[clamp(48px,7.5vh,84px)] aspect-[4/5]"
							/>
						)}
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
								aria-label={t(
									target ? "draft.roles.swapWithOf" : "draft.roles.swapOf",
									{ champion: name },
								)}
								disabled={props.disabled}
								onClick={(event) => {
									event.stopPropagation();
									props.onSwap?.(role);
								}}
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
	const { options } = useDraftSession();
	const [pending, setPending] = useState<Role | null>(null);
	const [swapped, setSwapped] = useState<readonly [Role, Role] | null>(null);
	const portrait = useCrossSwap(swapped);
	const [sending, setSending] = useState(false);
	const rival = side === "blue" ? "red" : "blue";
	const assigned = view[rival].roles;
	const nameAt = (role: Role) =>
		championLabel(options, picks[ROLES.indexOf(role)] ?? "");

	useEffect(() => {
		if (!pending) return;
		const cancel = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPending(null);
		};
		window.addEventListener("keydown", cancel);
		return () => window.removeEventListener("keydown", cancel);
	}, [pending]);

	const swap = (role: Role) => {
		setSwapped(null);
		if (!pending) return setPending(role);
		setPending(null);
		if (pending === role) return;
		const a = ROLES.indexOf(pending);
		const b = ROLES.indexOf(role);
		setSwapped([pending, role]);
		setPicks((current) => {
			const next = [...current];
			[next[a], next[b]] = [current[b] as string, current[a] as string];
			return next;
		});
	};
	const status = pending
		? t("draft.roles.swapWith", { champion: nameAt(pending) })
		: swapped
			? t("draft.roles.swapped", {
					a: nameAt(swapped[1]),
					b: nameAt(swapped[0]),
				})
			: t("draft.roles.ready");

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
					portrait={portrait}
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
					{status}
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
