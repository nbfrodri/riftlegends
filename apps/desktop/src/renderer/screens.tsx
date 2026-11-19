import { useTranslation } from "react-i18next";

// Placeholder screens: each one only names itself until its real content lands
// (Draft in the draft plans, Mercado's table in #44, Ajustes' language in #43).

function Screen({ title }: { title: string }) {
	return (
		<section className="px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{title}
			</h1>
		</section>
	);
}

export function DraftScreen() {
	const { t } = useTranslation();
	return <Screen title={t("shell.nav.draft")} />;
}

export function MarketScreen() {
	const { t } = useTranslation();
	return <Screen title={t("shell.nav.market")} />;
}

export function SettingsScreen() {
	const { t } = useTranslation();
	return <Screen title={t("shell.nav.settings")} />;
}
