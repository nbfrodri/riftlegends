/** `YYYY-MM-DD`, or just `YYYY` when only the year of birth is known. */
export const BIRTH_DATE =
	/^(?:\d{4}|\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/;

const valid = (birthDate: string) => {
	if (!BIRTH_DATE.test(birthDate)) return false;
	if (birthDate.length === 4) return true;
	const date = new Date(`${birthDate}T00:00:00Z`);
	return date.toISOString().slice(0, 10) === birthDate;
};

/** `birthDate` as validated by `BIRTH_DATE` and a real calendar day. */
export const isBirthDate = valid;

/**
 * Whole years on the game date `today` (`YYYY-MM-DD`). Pure: the caller
 * supplies the date, so it never reads the system clock. A year-only birth
 * date gives the difference of years. No date, or one after `today`, gives
 * undefined.
 */
export function ageOn(birthDate: string | undefined, today: string) {
	if (!birthDate || !valid(birthDate)) return undefined;
	const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
	const age =
		birthDate.length === 4 || today.slice(5) >= birthDate.slice(5)
			? years
			: years - 1;
	return age < 0 ? undefined : age;
}
