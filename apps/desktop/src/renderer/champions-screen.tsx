import { CONTENT_SETS, type Role, TIERS } from "@rift-legends/contracts";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChampionFilters } from "./champion-filters";
import { ChampionCard } from "./draft/board/champion-card";
import { ChampionPortrait } from "./draft/champion-portrait";
import { useRealBlock } from "./draft/real-content";
import { useDraftSession } from "./draft/session";

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

export function ChampionsScreen() {
	const { t, i18n } = useTranslation();
	const { options, content, setContent, sessionId, view } = useDraftSession();
	const block = useRealBlock(sessionId);
	const [role, setRole] = useState<Role>("top");
	const [query, setQuery] = useState("");
	const [selection, select] = useState<Selection | null>(null);
	const needle = query.trim().toLocaleLowerCase(i18n.language);
	const shown = options.champions
		.flatMap(({ id, name }) => {
			const position = options.positions[id]?.find((p) => p.role === role);
			return position && name.toLocaleLowerCase(i18n.language).includes(needle)
				? [{ id, name, tier: position.tier }]
				: [];
		})
		.sort((a, b) => a.name.localeCompare(b.name, i18n.language));
	const unavailable = new Set(
		view?.availability
			.filter((entry) => entry.status !== "free")
			.map((entry) => entry.champion),
	);
	return (
		<section className="flex h-full min-w-0 flex-col gap-3 px-gutter py-[clamp(14px,2.1vh,24px)]">
			<header className="flex items-center justify-between gap-4">
				<div>
					<p className="mb-1 text-sm text-muted">
						{options.season
							? t("champions.season", { season: options.season })
							: t("champions.fictionalSeason")}
					</p>
					<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
						{t("shell.nav.champions")}
					</h1>
				</div>
				<SegmentedControl
					label={t("draft.setup.content")}
					value={content}
					onChange={setContent}
					options={CONTENT_SETS.map((value) => ({
						value,
						label: t(`draft.setup.content.${value}`),
						disabled: !!view || (value === "real" && block !== null),
					}))}
				/>
			</header>
			<div className="flex items-center justify-between border-line border-b pb-3">
				<ChampionFilters
					role={role}
					onRole={setRole}
					query={query}
					onQuery={setQuery}
				/>
				{shown.length === 0 && (
					<span role="status" className="text-sm text-muted">
						{t("draft.board.noMatches")}
					</span>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
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
										<button
											key={id}
											type="button"
											aria-label={name}
											onClick={(event) =>
												select({ id, trigger: event.currentTarget })
											}
											className="group relative h-[clamp(64px,9vh,90px)] w-[clamp(72px,6vw,100px)] overflow-hidden rounded-control bg-surface outline-offset-[-2px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-action"
										>
											<ChampionPortrait
												id={id}
												size="tile"
												unavailable={unavailable.has(id)}
											/>
											<span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-xs font-semibold text-white">
												{name}
											</span>
										</button>
									))}
							</div>
						</section>
					))}
				</div>
			</div>
			{selection && (
				<CardDialog selection={selection} onClose={() => select(null)} />
			)}
		</section>
	);
}
