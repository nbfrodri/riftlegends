import type { MatchEvent, Role, Side } from "@rift-legends/contracts";
import { useTranslation } from "react-i18next";

const SIDES = ["blue", "red"] as const;

/**
 * Who took part in a contest with the ultimate on cooldown (plan 08, #339),
 * as the numbers note says who was dead: the side that missed more comes
 * first, so "their" is always that one. A role both sides were missing is
 * left out.
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
	const rolesOf = (side: Side) =>
		onCooldown[side]
			.filter(({ resource }) => resource === "ult")
			.map(({ role }) => role as Role);
	// A role both sides were missing tells nothing: only the differences count.
	const shared = rolesOf("blue").filter((role) =>
		rolesOf("red").includes(role),
	);
	const roles = (side: Side) =>
		rolesOf(side).filter((role) => !shared.includes(role));
	const ults = (side: Side) =>
		t("draft.match.ultimates.of", {
			count: roles(side).length,
			roles: list.format(
				roles(side).map((role) =>
					t("draft.match.numbers.of", {
						role: t(`draft.match.numbers.role.${role}`),
					}),
				),
			),
		});
	const missing = (side: Side) => roles(side).length;
	const [first, second] = [...SIDES].sort(
		(a, b) => missing(b) - missing(a) || (a === event.side ? -1 : 1),
	) as [Side, Side];
	if (missing(first) === 0) return null;
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
