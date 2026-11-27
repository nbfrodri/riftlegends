import { Button } from "@rift-legends/ui-kit/components/button";
import { useTranslation } from "react-i18next";

/** The tournament exists; playing it from its hub arrives with plan 31, issue 10. */
export function TournamentReady(props: {
	name: string;
	count: number;
	team: string | null;
	onNew: () => void;
}) {
	const { t } = useTranslation();
	return (
		<section className="max-w-[640px] bg-panel p-[clamp(14px,1.5vw,24px)]">
			<h2 className="font-bold font-display text-xl tracking-heading">
				{t("tournament.ready")}
			</h2>
			<p className="mt-2">
				{t("tournament.readySummary", { name: props.name, count: props.count })}
			</p>
			<p className="mt-1 text-muted">
				{props.team
					? t("tournament.readyMine", { team: props.team })
					: t("tournament.readyWatch")}
			</p>
			<Button
				variant="secondary"
				className="mt-4 px-3 py-[5px]"
				onClick={props.onNew}
			>
				{t("tournament.new")}
			</Button>
		</section>
	);
}
