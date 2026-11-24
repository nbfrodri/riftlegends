import type { Role } from "@rift-legends/contracts";
import { ROLES, TIERS } from "@rift-legends/contracts";
import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameRoleIcon } from "./assets/game-role-icon";
import { ChampionFilters } from "./champion-filters";
import { ChampionCard } from "./draft/board/champion-card";
import { ChampionPortrait } from "./draft/champion-portrait";
import { useRealBlock } from "./draft/real-content";
import { DraftSessionProvider, useDraftSession } from "./draft/session";

interface Selection {
	id: string;
	trigger: HTMLButtonElement;
}

function CardDialog({
	selection,
	onClose,
}: {
	selection: Selection;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const dialog = useRef<HTMLDialogElement>(null);
	// Only a press that starts and ends on the backdrop closes (not a drag out).
	const pressedBackdrop = useRef(false);
	useEffect(() => {
		const current = dialog.current;
		current?.showModal();
		return () => {
			current?.close();
			selection.trigger.focus({ preventScroll: true });
		};
	}, [selection]);
	return (
		<dialog
			ref={dialog}
			aria-label={t("draft.card.title")}
			onCancel={onClose}
			onPointerDown={(event) => {
				pressedBackdrop.current = event.target === event.currentTarget;
			}}
			onClick={(event) => {
				if (pressedBackdrop.current && event.target === event.currentTarget)
					onClose();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="m-auto h-[min(82dvh,760px)] max-h-full w-[min(88vw,1080px)] bg-transparent p-0 text-text backdrop:bg-black/65"
		>
			<ChampionCard id={selection.id} large onClose={onClose} />
		</dialog>
	);
}

type View = "tiers" | "list";

interface Listed {
	id: string;
	name: string;
	positions: readonly { role: Role; tier: string }[];
}

/** Every champion by name, with each role it plays and its tier there. */
function FullList({
	champions,
	onOpen,
}: {
	champions: readonly Listed[];
	onOpen: (id: string, trigger: HTMLButtonElement) => void;
}) {
	const { t } = useTranslation();
	return (
		<ul
			aria-label={t("champions.all")}
			className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] content-start gap-1.5 p-0"
		>
			{champions.map(({ id, name, positions }) => (
				<li key={id}>
					<button
						type="button"
						aria-label={name}
						aria-describedby={`champion-roles-${id}`}
						onClick={(event) => onOpen(id, event.currentTarget)}
						className="press flex w-full items-center gap-3 rounded-control border border-line bg-panel p-1.5 pr-3 text-left outline-offset-[-2px] hover:border-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-action"
					>
						<span className="flex shrink-0 [&>span]:size-11">
							<ChampionPortrait id={id} size="ban" />
						</span>
						<span className="min-w-0 flex-1 truncate font-semibold">
							{name}
						</span>
						<span
							id={`champion-roles-${id}`}
							className="flex shrink-0 items-center gap-2.5"
						>
							{positions.map(({ role, tier }) => (
								<span key={role} className="flex items-center gap-1">
									<GameRoleIcon
										role={role}
										size={16}
										label={t(`market.role.${role}`)}
									/>
									<span className="font-display font-bold text-sm">{tier}</span>
								</span>
							))}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}

/** The `/campeones` route: its own core session, outside any series. */
export function ChampionsScreen() {
	return (
		<DraftSessionProvider>
			<ChampionsCatalog />
		</DraftSessionProvider>
	);
}

function MissingContent() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	return (
		<div className="grid flex-1 place-content-center justify-items-center gap-3 text-center">
			<p className="max-w-md text-muted">{t("champions.missing")}</p>
			<Button onClick={() => void navigate({ to: "/ajustes" })}>
				{t("champions.toSettings")}
			</Button>
		</div>
	);
}

function ChampionsCatalog() {
	const { t, i18n } = useTranslation();
	const { options, content, sessionId } = useDraftSession();
	const block = useRealBlock(sessionId);
	const [role, setRole] = useState<Role>("top");
	const [query, setQuery] = useState("");
	const [view, setView] = useState<View>("tiers");
	const [selection, select] = useState<Selection | null>(null);
	const blocked = content === "real" && block !== null;
	const needle = query.trim().toLocaleLowerCase(i18n.language);
	const matching: Listed[] = options.champions
		.filter(({ name }) =>
			name.toLocaleLowerCase(i18n.language).includes(needle),
		)
		.map(({ id, name }) => ({
			id,
			name,
			positions: [...(options.positions[id] ?? [])].sort(
				(a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role),
			),
		}))
		.sort((a, b) => a.name.localeCompare(b.name, i18n.language));
	const shown = matching.flatMap(({ id, name, positions }) => {
		const position = positions.find((p) => p.role === role);
		return position ? [{ id, name, tier: position.tier }] : [];
	});
	const empty = (view === "tiers" ? shown : matching).length === 0;
	const open = (id: string, trigger: HTMLButtonElement) =>
		select({ id, trigger });
	return (
		<section className="flex h-full min-w-0 flex-col gap-3 px-gutter py-[clamp(14px,2.1vh,24px)]">
			<header>
				<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
					{t("shell.nav.champions")}
				</h1>
			</header>
			{blocked ? (
				block !== "checking" && <MissingContent />
			) : (
				<>
					<div className="flex items-center justify-between gap-3 border-line border-b pb-3">
						<div className="flex min-w-0 items-center gap-3">
							<SegmentedControl
								label={t("champions.view")}
								value={view}
								onChange={setView}
								options={[
									{ value: "tiers", label: t("champions.tiers") },
									{ value: "list", label: t("champions.list") },
								]}
								className="shrink-0 text-[13px]"
							/>
							<ChampionFilters
								role={role}
								onRole={setRole}
								roles={view === "tiers"}
								query={query}
								onQuery={setQuery}
							/>
						</div>
						{empty && (
							<span role="status" className="text-sm text-muted">
								{t("draft.board.noMatches")}
							</span>
						)}
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{view === "list" ? (
							<FullList champions={matching} onOpen={open} />
						) : (
							<div className="flex min-h-full flex-col gap-1.5">
								{TIERS.map((tier) => (
									<section
										key={tier}
										aria-label={t("draft.card.tier", { tier })}
										className="grid min-h-16 flex-1 grid-cols-[64px_1fr] border border-line bg-panel"
									>
										<h2 className="grid place-items-center border-line border-r bg-surface font-display text-2xl font-bold tracking-heading text-action">
											{tier}
										</h2>
										<div className="flex flex-wrap items-center gap-1.5 p-1.5">
											{shown
												.filter((champion) => champion.tier === tier)
												.map(({ id, name }) => (
													<Tooltip key={id} content={name}>
														<button
															type="button"
															aria-label={name}
															onClick={(event) => open(id, event.currentTarget)}
															className="relative h-[clamp(64px,9vh,90px)] w-[clamp(72px,6vw,100px)] overflow-hidden rounded-control bg-surface outline-offset-[-2px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-action"
														>
															<ChampionPortrait id={id} size="tile" />
														</button>
													</Tooltip>
												))}
										</div>
									</section>
								))}
							</div>
						)}
					</div>
				</>
			)}
			{selection && (
				<CardDialog selection={selection} onClose={() => select(null)} />
			)}
		</section>
	);
}
