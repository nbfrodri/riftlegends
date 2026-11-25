import { LOCALES } from "@rift-legends/i18n";
import { buttonStyle } from "@rift-legends/ui-kit/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rift-legends/ui-kit/components/select";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ContentSettings } from "./assets/content-settings";
import { CursorSettings } from "./cursor/cursor-settings";
import { isLocale, storeLanguage } from "./language";
import { SoundSettings } from "./sound/sound-settings";

// Placeholder screens: each one only names itself until its real content lands
// Draft and Mercado have their own files.

export { DraftScreen } from "./draft/draft-screen";
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
			<SoundSettings />
			<CursorSettings />
			<section
				aria-labelledby="settings-credits"
				className="mx-[clamp(14px,1.35vw,28px)] mt-[clamp(14px,2.1vh,24px)] max-w-[640px] bg-panel px-[clamp(12px,1.15vw,18px)] py-[clamp(10px,1.5vh,16px)]"
			>
				<h2
					id="settings-credits"
					className="font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]"
				>
					{t("settings.credits.title")}
				</h2>
				<p className="mt-1 text-muted">{t("settings.credits.description")}</p>
				<Link
					to="/ajustes/creditos"
					className={`mt-3 ${buttonStyle("secondary")}`}
				>
					{t("settings.credits.open")}
				</Link>
			</section>
		</>
	);
}
