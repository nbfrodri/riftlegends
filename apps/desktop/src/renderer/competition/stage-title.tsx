import { useTranslation } from "react-i18next";
import { stageLabel } from "./names";

/** A stage as two lines: its split (when it has one), then the stage. */
export function StageTitle({ row }: { row: Parameters<typeof stageLabel>[1] }) {
	const { t } = useTranslation();
	const { split, stage } = stageLabel(t, row);
	return (
		<span className="min-w-0">
			{split && (
				<span className="block truncate text-[12px] text-muted">{split}</span>
			)}
			<span className="block truncate font-semibold">{stage}</span>
		</span>
	);
}
