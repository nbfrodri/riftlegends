import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
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
	// Left, so the tooltip never covers the card on the right.
	return (
		<Tooltip content={t("draft.card.shortcut")} shortcut="I" side="left">
			<button
				type="button"
				className="ml-auto inline-flex items-center gap-1 text-xs text-muted"
			>
				<Info aria-hidden size={14} />
				{t("draft.card.hint")}
			</button>
		</Tooltip>
	);
}
