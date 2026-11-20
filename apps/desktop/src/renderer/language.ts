import { LOCALES, type Locale } from "@rift-legends/i18n";

export const LANGUAGE_STORAGE_KEY = "riftlegends.language";

export const isLocale = (value: unknown): value is Locale =>
	LOCALES.some((locale) => locale === value);

// Storage may be unavailable or hold junk: it must never block the app.
function storedLanguage(): Locale | null {
	try {
		const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		return isLocale(value) ? value : null;
	} catch {
		return null;
	}
}

/** The stored language choice wins over the system locale. */
export async function initialLocale(
	systemLocale: () => Promise<string>,
): Promise<string> {
	const stored = storedLanguage();
	if (stored) return stored;

	try {
		return await systemLocale();
	} catch {
		return "en";
	}
}

export function storeLanguage(language: Locale): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
	} catch {
		// The change still applies for this session.
	}
}
