import type { Side } from "@rift-legends/contracts";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useTranslation } from "react-i18next";
import { TeamCrest } from "../team-crest";

export function TeamColumnHeader({
	id,
	side,
	first,
	team,
	name,
	sideText,
}: {
	id: string;
	side: Side;
	first: boolean;
	team: string;
	name: string;
	sideText: string;
}) {
	const { t } = useTranslation();
	return (
		<header className={`flex items-center justify-between gap-3.5 ${sideText}`}>
			<div className="min-w-0">
				<p className="font-semibold text-[12px] uppercase tracking-[0.055em]">
					<span id={`${id}-side`}>{t(`draft.side.${side}`)}</span>
					{first && (
						<span className="ml-2 text-text">{t("draft.side.first")}</span>
					)}
				</p>
				<Tooltip content={name}>
					<h2
						id={`${id}-team`}
						className="truncate font-bold font-display text-[29px] text-text leading-tight tracking-heading"
					>
						{name}
					</h2>
				</Tooltip>
			</div>
			<span className="shrink-0 [&_img]:h-12 [&_img]:w-16 [&_svg]:h-12 [&_svg]:w-16">
				<TeamCrest id={team} name={name} />
			</span>
		</header>
	);
}
