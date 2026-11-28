import type { MatchEvent, Role, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";

const SIDES = ["blue", "red"] as const;

/**
 * Who took part in a contest with the ultimate on cooldown (plan 08, #339),
 * as the numbers note says who was dead: the side that missed more comes
 * first, so "their" is always that one.
 */
export function UltimatesNote({
	event,
}: {
	event: Pick<MatchEvent, "kind" | "side" | "onCooldown">;
}) {
	const { t, i18n } = useTranslation();
	const { onCooldown } = event;
	if (!onCooldown) return null;
	const list = new Intl.ListFormat(i18n.language);
	const ults = (side: Side) => {
		const roles = onCooldown[side]
			.filter(({ resource }) => resource === "ult")
			.map(({ role }) => role as Role);
		return t("draft.match.ultimates.of", {
			count: roles.length,
			roles: list.format(
				roles.map((role) =>
					t("draft.match.numbers.of", {
						role: t(`draft.match.numbers.role.${role}`),
					}),
				),
			),
		});
	};
	const missing = (side: Side) => onCooldown[side].length;
	const [first, second] = [...SIDES].sort(
		(a, b) => missing(b) - missing(a) || (a === event.side ? -1 : 1),
	) as [Side, Side];
	return (
		<p className="text-muted">
			{t(
				event.kind === "fight"
					? "draft.match.ultimates.fight"
					: "draft.match.ultimates.contest",
				{ ults: ults(first) },
			)}
			{missing(second) > 0 && (
				<> {t("draft.match.ultimates.rivals", { ults: ults(second) })}</>
			)}
		</p>
	);
}
