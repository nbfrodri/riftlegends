import type { Personality } from "@rift-legends/contracts";
import type { Report, Tally } from "./metric";
import { PHASES } from "./replay";

const pct = (hits: number, turns: number) => {
	if (turns === 0) return "-";
	const basis = (hits * 10_000 - ((hits * 10_000) % turns)) / turns;
	const cents = basis % 100;
	return `${(basis - cents) / 100}.${cents < 10 ? "0" : ""}${cents}%`;
};

const row = (name: string, t: Tally) =>
	`| ${name} | ${t.turns} | ${pct(t.top1, t.turns)} | ${pct(t.top3, t.turns)} |`;

/** Markdown tables of top 1 and top 3, overall and by phase, league and personality. */
export function formatReport(title: string, report: Report): string {
	const rows = [
		row("total", report.overall),
		...PHASES.map((p) => row(p, report.phases[p])),
		...Object.keys(report.leagues)
			.sort()
			.map((l) => row(l, report.leagues[l] as Tally)),
		...(Object.keys(report.personalities).sort() as Personality[]).map((p) =>
			row(p, report.personalities[p] as Tally),
		),
	];
	return [
		`### ${title}`,
		"| Grupo | Turnos | Top 1 | Top 3 |",
		"| --- | --- | --- | --- |",
		...rows,
	].join("\n");
}
