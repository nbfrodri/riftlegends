import { SegmentedControl } from "@rift-legends/ui-kit/components/segmented-control";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getGameCursor, setGameCursor, subscribeGameCursor } from "./settings";

/** Settings: turns the game cursor on or off (#515). */
export function CursorSettings() {
	const { t } = useTranslation();
	const enabled = useSyncExternalStore(subscribeGameCursor, getGameCursor);
	return (
		<section
			aria-labelledby="settings-cursor"
			className="mx-[clamp(14px,1.35vw,28px)] mt-[clamp(14px,2.1vh,24px)] max-w-[640px] bg-panel px-[clamp(12px,1.15vw,18px)] py-[clamp(10px,1.5vh,16px)]"
		>
			<h2
				id="settings-cursor"
				className="font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]"
			>
				{t("settings.cursor.title")}
			</h2>
			<p className="mt-1 text-muted">{t("settings.cursor.description")}</p>
			<SegmentedControl
				label={t("settings.cursor.title")}
				value={enabled ? "on" : "off"}
				onChange={(value) => setGameCursor(value === "on")}
				options={[
					{ value: "on", label: t("settings.cursor.on") },
					{ value: "off", label: t("settings.cursor.off") },
				]}
				className="mt-3 text-[13px]"
			/>
		</section>
	);
}
