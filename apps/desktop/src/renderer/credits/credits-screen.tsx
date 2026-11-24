import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { LIBRARIES, riotNotice, SOURCES } from "./credits-data";

const panel =
	"mt-[clamp(14px,2.1vh,24px)] max-w-[760px] bg-panel px-[clamp(12px,1.15vw,18px)] py-[clamp(10px,1.5vh,16px)]";
const linkStyle =
	"text-action underline underline-offset-3 hover:text-text focus-visible:outline-2 focus-visible:outline-action";

/** Opens in the system browser: the main process denies the window and hands the URL over. */
function ExternalLink({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer noopener"
			className={linkStyle}
		>
			{children}
		</a>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	const id = useId();
	return (
		<section
			aria-labelledby={id}
			className={`mx-[clamp(14px,1.35vw,28px)] ${panel}`}
		>
			<h2
				id={id}
				className="font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]"
			>
				{title}
			</h2>
			{children}
		</section>
	);
}

/** Settings, «Créditos»: data sources, licences and legal notice (plan 11, A6). */
export function CreditsScreen() {
	const { t } = useTranslation();
	return (
		<>
			<section className="px-[clamp(14px,1.35vw,28px)] pt-[clamp(14px,2.1vh,24px)]">
				<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
					{t("credits.title")}
				</h1>
				<Link to="/ajustes" className={`mt-2 inline-block ${linkStyle}`}>
					{t("credits.back")}
				</Link>
			</section>
			<Panel title={t("credits.sources.title")}>
				<ul className="mt-2 grid gap-2">
					{SOURCES.map((source) => (
						<li key={source.id}>
							<ExternalLink href={source.url}>{source.name}</ExternalLink>
							{source.licence && source.licenceUrl && (
								<>
									{" · "}
									<ExternalLink href={source.licenceUrl}>
										{source.licence}
									</ExternalLink>
								</>
							)}
							<p className="text-muted">{t(`credits.sources.${source.id}`)}</p>
						</li>
					))}
				</ul>
			</Panel>
			<Panel title={t("credits.legal.title")}>
				<p className="mt-2">{riotNotice}</p>
				<p className="mt-2 text-muted">{t("credits.legal.assets")}</p>
			</Panel>
			<Panel title={t("credits.libraries.title")}>
				<p className="mt-1 text-muted">{t("credits.libraries.description")}</p>
				<ul
					aria-label={t("credits.libraries.title")}
					className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 gap-y-1"
				>
					{LIBRARIES.map((library) => (
						<li key={library.name}>
							<ExternalLink href={library.url}>{library.name}</ExternalLink>
							<span className="text-muted"> · {library.licence}</span>
						</li>
					))}
				</ul>
			</Panel>
			<div className="h-[clamp(14px,2.1vh,24px)]" />
		</>
	);
}
