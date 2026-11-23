import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@rift-legends/ui-kit/components/tooltip";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const seenKey = "rift.draft.championCardHelpSeen";
export function ChampionCardHelp() {
	const { t } = useTranslation();
	const [first] = useState(() => {
		try {
			return localStorage.getItem(seenKey) !== "true";
		} catch {
			return true;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem(seenKey, "true");
		} catch {
			/* Help stays available without storage. */
		}
	}, []);
	return first ? (
		<p className="mb-1.5 border-l-2 border-action pl-2 text-xs text-muted">
			{t("draft.card.help")}
		</p>
	) : null;
}

export function ChampionCardHint() {
	const { t } = useTranslation();
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className="ml-auto inline-flex items-center gap-1 text-xs text-muted"
					/>
				}
			>
				<Info aria-hidden size={14} />
				{t("draft.card.hint")}
			</TooltipTrigger>
			<TooltipContent side="top">{t("draft.card.shortcut")}</TooltipContent>
		</Tooltip>
	);
}
