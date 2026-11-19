import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json" with { type: "json" };
import es from "../locales/es.json" with { type: "json" };

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const resources = {
	es: { translation: es },
	en: { translation: en },
} as const;

declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "translation";
		keySeparator: false;
		resources: (typeof resources)["en"];
	}
}

/** Maps a system locale string (e.g. `app.getLocale()`) to a supported locale. */
export function resolveLocale(systemLocale: string): Locale {
	return systemLocale.toLowerCase().split(/[-_]/)[0] === "es" ? "es" : "en";
}

/** Creates an initialised i18next instance; no detection, backends or persistence. */
export async function createI18n(systemLocale: string): Promise<i18n> {
	const instance = i18next.createInstance();
	await instance.use(initReactI18next).init({
		lng: resolveLocale(systemLocale),
		fallbackLng: "en",
		resources,
		keySeparator: false,
		interpolation: { escapeValue: false },
	});
	return instance;
}
