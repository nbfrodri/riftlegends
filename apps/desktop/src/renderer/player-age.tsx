import { ageOn } from "@rift-legends/contracts/age";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import { useTranslation } from "react-i18next";
import { placeholderToday } from "./placeholder-players";

/**
 * The age on the game date (never the system clock), or undefined when the
 * birth date is unknown. Until careers exist the game date is the placeholder
 * the sidebar shows.
 */
export const playerAge = (birthDate?: string) =>
	ageOn(birthDate, placeholderToday);

/**
 * A player's age as a number, `~` before it when only the birth year is
 * known; a dash with an «Age unknown» tooltip without a date.
 */
export function PlayerAge({
	birthDate,
	withUnit = false,
}: {
	birthDate?: string;
	/** «31 years» instead of «31». */
	withUnit?: boolean;
}) {
	const { t } = useTranslation();
	const age = playerAge(birthDate);
	if (age === undefined) {
		const label = t("database.age.unknown");
		return (
			<Tooltip content={label}>
				<span role="img" aria-label={label}>
					—
				</span>
			</Tooltip>
		);
	}
	const shown = birthDate?.length === 4 ? `~${age}` : String(age);
	return (
		<span>{withUnit ? t("database.age.years", { age: shown }) : shown}</span>
	);
}
