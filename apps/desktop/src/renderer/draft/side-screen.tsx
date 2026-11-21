import { Button } from "@rift-legends/ui-kit/components/button";
import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { teamName, useDraftSession } from "./session";

type Side = "blue" | "red";

/**
 * U2: the chooser picks blue or red. Show the AI's choice briefly before the board opens.
 */
export function SideScreen() {
	const { t } = useTranslation();
	const { view, options, mine, send, present, presentation } =
		useDraftSession();
	const [side, setSide] = useState<Side>("blue");

	const chooser = view?.phase === "side" ? view.turn?.team : undefined;
	const aiChooses = chooser !== undefined && chooser !== mine;

	if (!view) return null;

	if (presentation === "side") {
		const rows = [
			{ side: "blue", team: view.blue.team },
			{ side: "red", team: view.red.team },
		] as const;
		const chosen = mine === view.blue.team ? view.red.team : view.blue.team;
		return (
			<>
				<p>{t("draft.side.aiChose", { team: teamName(options, chosen) })}</p>
				<dl className="max-w-md space-y-2">
					{rows.map((row) => (
						<div
							key={row.side}
							className="flex justify-between border-line border-b py-2"
						>
							<dt className="text-muted">{t(`draft.side.${row.side}`)}</dt>
							<dd className="font-semibold">{teamName(options, row.team)}</dd>
						</div>
					))}
				</dl>
				<footer className="mt-auto flex justify-end border-line border-t pt-[14px]">
					<Button onClick={() => present(null)}>
						{t("draft.side.continue")}
						<ArrowRight aria-hidden="true" className="size-4" />
					</Button>
				</footer>
			</>
		);
	}

	if (aiChooses) {
		return (
			<p role="status" className="text-muted">
				{t("draft.side.aiChoosing", { team: teamName(options, chooser) })}
			</p>
		);
	}

	const name = teamName(options, chooser ?? "");
	return (
		<>
			<p>{t("draft.side.youChoose", { team: name })}</p>
			<p className="text-muted">
				{view.game === 1 ? t("draft.side.bySeed") : t("draft.side.byLoss")}
			</p>
			<SegmentedControl
				label={t("draft.side.label", { team: name })}
				options={[
					{ value: "blue", label: t("draft.side.blue") },
					{ value: "red", label: t("draft.side.red") },
				]}
				value={side}
				onChange={setSide}
			/>
			<footer className="mt-auto flex justify-end border-line border-t pt-[14px]">
				<Button
					onClick={() => void send("side.choose", { team: chooser, side })}
				>
					{t("draft.side.continue")}
					<ArrowRight aria-hidden="true" className="size-4" />
				</Button>
			</footer>
		</>
	);
}
