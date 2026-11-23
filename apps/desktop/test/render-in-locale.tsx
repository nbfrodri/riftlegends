import { createI18n } from "@rift-legends/i18n";
import { TooltipProvider } from "@rift-legends/ui-kit/components/tooltip";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";

/** Renders `ui` with the catalogs of a system locale (English by default). */
export async function renderInLocale(ui: ReactElement, locale = "en-US") {
	const i18n = await createI18n(locale);
	return render(
		<I18nextProvider i18n={i18n}>
			<TooltipProvider>{ui}</TooltipProvider>
		</I18nextProvider>,
	);
}
