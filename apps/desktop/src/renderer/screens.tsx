import { LOCALES } from "@rift-legends/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { useTranslation } from "react-i18next";
import { ContentSettings } from "./assets/content-settings";
import { isLocale, storeLanguage } from "./language";

export { MarketScreen } from "./market-screen";

function Screen({ title }: { title: string }) {
	return (
		<section className="px-[clamp(14px,1.35vw,28px)] py-[clamp(14px,2.1vh,24px)]">
			<h1 className="font-bold font-display text-[clamp(29px,2.5vw,48px)] uppercase leading-none tracking-heading">
				{title}
			</h1>
		</section>
	);
}

export function SettingsScreen() {
	const { t, i18n } = useTranslation();
	const items = LOCALES.map((value) => ({
		value,
		label: t(`language.${value}`),
	}));

	function change(value: string | null) {
		if (!isLocale(value)) return;
		void i18n.changeLanguage(value);
		document.documentElement.lang = value;
		storeLanguage(value);
	}

	return (
		<>
			<Screen title={t("shell.nav.settings")} />
			<div className="flex items-center gap-3 px-[clamp(14px,1.35vw,28px)]">
				<span className="text-muted">{t("settings.language")}</span>
				<Select items={items} value={i18n.language} onValueChange={change}>
					<SelectTrigger aria-label={t("settings.language")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map(({ value, label }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<ContentSettings />
		</>
	);
}
