import type { MatchEvent, Role, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";

const SIDES = ["blue", "red"] as const;

/**
 * Who was down when a contest began, as the cause `numbers` of the event
 * (plan 08, #529): the side with fewer players up comes first, so "their"
 * is always the one that was short.
 */
export function NumbersNote({
	event,
}: {
	event: Pick<MatchEvent, "kind" | "side" | "down">;
}) {
	const { t, i18n } = useTranslation();
	const { down } = event;
	if (!down) return null;
	const list = new Intl.ListFormat(i18n.language);
	const roles = (items: readonly Role[]) =>
		list.format(
			items.map((role) =>
				t("draft.match.numbers.of", {
					role: t(`draft.match.numbers.role.${role}`),
				}),
			),
		);
	const missing = (items: readonly Role[]) =>
		t("draft.match.numbers.down", {
			count: items.length,
			roles: roles(items),
		});
	if (event.kind === "lane") {
		const short = SIDES.find((side) => down[side].length > 0) as Side;
		return (
			<p className="text-muted">
				{t("draft.match.numbers.lane", { down: missing(down[short]) })}
			</p>
		);
	}
	const up = (side: Side) => 5 - down[side].length;
	const [first, second] = [...SIDES].sort(
		(a, b) => up(a) - up(b) || (a === event.side ? -1 : 1),
	) as [Side, Side];
	const text = t(
		event.kind === "fight"
			? "draft.match.numbers.fight"
			: "draft.match.numbers.contest",
		{
			short: up(first),
			long: up(second),
			down: missing(down[first]),
		},
	);
	return (
		<p className="text-muted">
			{text}
			{down[first].length > 0 && down[second].length > 0 && (
				<> {t("draft.match.numbers.rivals", { roles: roles(down[second]) })}</>
			)}
		</p>
	);
}
