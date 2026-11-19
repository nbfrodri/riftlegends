import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import { createI18n } from "../src/index";

function Sample() {
	const { t } = useTranslation();
	return (
		<div>
			<h1>{t("shell.title")}</h1>
			<span>{t("shell.nav.draft")}</span>
			<span>{t("shell.comingSoon")}</span>
		</div>
	);
}

afterEach(cleanup);

describe("useTranslation", () => {
	it.each([
		["es-ES", "Próximamente"],
		["en-US", "Coming soon"],
		["fr-FR", "Coming soon"],
	])("renders %s", async (locale, soon) => {
		const i18n = await createI18n(locale);
		render(
			<I18nextProvider i18n={i18n}>
				<Sample />
			</I18nextProvider>,
		);
		expect(screen.getByText(soon)).toBeDefined();
		expect(screen.getByText("Draft")).toBeDefined();
		expect(screen.getByRole("heading").textContent).toBe("Rift Legends");
	});
});
