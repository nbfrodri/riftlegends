import { COUNTRY_CODES } from "@rift-legends/contracts/country-codes";
import { Tooltip } from "@rift-legends/ui-kit/components/tooltip";
import * as flags from "country-flag-icons/react/3x2";
import { useTranslation } from "react-i18next";

export function CountryFlag({
	country,
	className = "h-3 w-[18px]",
}: {
	country?: string | undefined;
	/** Tailwind size classes of the 3:2 flag; 18×12 px by default. */
	className?: string;
}) {
	const { i18n } = useTranslation();
	if (!country || !COUNTRY_CODES.has(country) || !Object.hasOwn(flags, country))
		return null;
	// biome-ignore lint/performance/noDynamicNamespaceImportAccess: Bundle every flag so new snapshots work offline.
	const Flag = flags[country as keyof typeof flags];
	const name = new Intl.DisplayNames(i18n.resolvedLanguage ?? i18n.language, {
		type: "region",
		fallback: "none",
	}).of(country);
	if (!name) return null;
	return (
		<Tooltip content={name}>
			<span className="inline-flex shrink-0 align-middle">
				<Flag role="img" aria-label={name} className={className} />
			</span>
		</Tooltip>
	);
}
