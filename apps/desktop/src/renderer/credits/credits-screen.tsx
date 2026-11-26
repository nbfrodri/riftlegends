import { buttonStyle } from "@rift-legends/ui-kit/components/button";
import { cn } from "@rift-legends/ui-kit/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	BookOpenText,
	ExternalLink,
	Images,
	type LucideIcon,
	MousePointer2,
	Scale,
	Trophy,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import {
	LIBRARIES,
	LIBRARY_GROUPS,
	riotNotice,
	SOURCES,
	type Source,
} from "./credits-data";

const ICONS: Record<Source["id"], LucideIcon> = {
	leaguepedia: BookOpenText,
	communityDragon: Images,
	lolesports: Trophy,
	kenney: MousePointer2,
};

const gutter = "px-[clamp(14px,1.35vw,28px)]";
const badge =
	"inline-flex items-center rounded-control border border-line px-[7px] py-[4px] font-bold text-[12px] text-muted leading-none";
// Links change their fill and border on hover, never underline (#376, #399).
const hoverable = "press hover:border-text hover:bg-surface hover:text-text";

/** Opens in the system browser: the main process denies the window and hands the URL over. */
function Outbound({
	href,
	className,
	label,
	children,
}: {
	href: string;
	className: string;
	label?: string;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer noopener"
			aria-label={label}
			className={className}
		>
			{children}
		</a>
	);
}

function SourceCard({ source }: { source: Source }) {
	const { t } = useTranslation();
	const Icon = ICONS[source.id];
	return (
		<article
			aria-label={source.name}
			className="flex flex-col gap-[clamp(8px,1.3vh,12px)] border border-line bg-panel p-[clamp(12px,1.15vw,18px)]"
		>
			<div className="flex items-center gap-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface text-action">
					<Icon aria-hidden size={22} strokeWidth={1.65} />
				</span>
				<h3 className="font-bold font-display text-[clamp(15px,1.2vw,19px)] leading-[1.1] tracking-[-0.035em]">
					{source.name}
				</h3>
			</div>
			<p className="flex-1 text-[14px] text-muted leading-snug">
				{t(`credits.sources.${source.id}`)}
			</p>
			<div className="flex items-center justify-between gap-2">
				{source.licence && source.licenceUrl ? (
					<Outbound
						href={source.licenceUrl}
						className={cn(badge, "text-action", hoverable)}
					>
						{source.licence}
					</Outbound>
				) : (
					source.badge && (
						<span className={badge}>
							{t(`credits.sources.badge.${source.badge}`)}
						</span>
					)
				)}
				<Outbound
					href={source.url}
					label={t("credits.sources.visitLabel", { name: source.name })}
					className={cn(
						buttonStyle("secondary"),
						"px-[10px] py-[6px] text-[13px]",
					)}
				>
					{t("credits.sources.visit")}
					<ExternalLink aria-hidden size={14} />
				</Outbound>
			</div>
		</article>
	);
}

function Section({
	title,
	className,
	children,
}: {
	title: string;
	className?: string;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} className={cn(gutter, className)}>
			<h2
				id={id}
				className="font-bold font-display text-[clamp(13px,1vw,16px)] uppercase leading-none tracking-heading"
			>
				{title}
			</h2>
			{children}
		</section>
	);
}

function LibraryGroups() {
	const { t } = useTranslation();
	return (
		<div className="mt-3 grid grid-cols-2 gap-x-[clamp(16px,2vw,32px)] gap-y-[clamp(10px,1.6vh,16px)]">
			{LIBRARY_GROUPS.map((group) => {
				const label = t(`credits.libraries.group.${group}`);
				return (
					<div key={group}>
						<h3 className="font-bold text-[12px] text-muted uppercase tracking-[0.06em]">
							{label}
						</h3>
						<ul aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
							{LIBRARIES.filter((library) => library.group === group).map(
								(library) => (
									<li key={library.name}>
										<Outbound
											href={library.url}
											className={cn(
												"inline-flex items-center gap-1.5 rounded-control border border-line bg-panel px-2 py-[5px] text-[13px] text-text leading-none",
												hoverable,
											)}
										>
											{library.name}{" "}
											<span className="text-muted">{library.licence}</span>
										</Outbound>
									</li>
								),
							)}
						</ul>
					</div>
				);
			})}
		</div>
	);
}

/** Settings, «Créditos»: data sources, libraries and legal notice (plan 11, A6). */
export function CreditsScreen() {
	const { t } = useTranslation();
	return (
		<div className="flex min-h-full flex-col gap-[clamp(16px,2.6vh,28px)] pt-[clamp(14px,2.1vh,24px)]">
			<header className={cn(gutter, "flex items-center justify-between gap-4")}>
				<div className="flex items-center gap-3">
					<img src="./icon-small.svg" alt="" width="36" height="36" />
					<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
						{t("credits.title")}
					</h1>
				</div>
				<Link to="/ajustes" className={buttonStyle("secondary")}>
					{t("credits.back")}
				</Link>
			</header>
			<Section title={t("credits.sources.title")}>
				<div className="mt-3 grid grid-cols-3 gap-[clamp(10px,1vw,16px)]">
					{SOURCES.map((source) => (
						<SourceCard key={source.id} source={source} />
					))}
				</div>
			</Section>
			<Section title={t("credits.libraries.title")}>
				<p className="mt-2 text-[14px] text-muted">
					{t("credits.libraries.description")}
				</p>
				<LibraryGroups />
			</Section>
			<Section
				title={t("credits.legal.title")}
				className="mt-auto border-line border-t bg-panel py-[clamp(10px,1.5vh,14px)] text-[12px] text-muted leading-snug"
			>
				<p className="mt-1.5 flex gap-1.5">
					<Scale aria-hidden size={14} className="mt-px shrink-0" />
					<span>
						{riotNotice} {t("credits.legal.assets")}
					</span>
				</p>
			</Section>
		</div>
	);
}
