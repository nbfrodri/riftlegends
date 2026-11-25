import { IconButton } from "@rift-legends/ui-kit/components/icon-button";
import { Slider } from "@rift-legends/ui-kit/components/slider";
import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
	getSoundSettings,
	type SoundSettings as Settings,
	setSoundSettings,
	subscribeSoundSettings,
} from "./settings";

const volumes = [
	{ level: "master", muted: "masterMuted", mute: "muteMaster" },
	{ level: "effects", muted: "effectsMuted", mute: "muteEffects" },
] as const;

/** Settings: master and effects volume, each with a slider and mute (#472). */
export function SoundSettings() {
	const { t } = useTranslation();
	const settings = useSyncExternalStore(
		subscribeSoundSettings,
		getSoundSettings,
	);
	const update = (change: Partial<Settings>) =>
		setSoundSettings({ ...getSoundSettings(), ...change });
	const format = (value: number) => t("settings.sound.value", { value });
	return (
		<section
			aria-labelledby="settings-sound"
			className="mx-[clamp(14px,1.35vw,28px)] mt-[clamp(14px,2.1vh,24px)] max-w-[640px] bg-panel px-[clamp(12px,1.15vw,18px)] py-[clamp(10px,1.5vh,16px)]"
		>
			<h2
				id="settings-sound"
				className="font-bold font-display text-[clamp(16px,1.45vw,23px)] leading-[1.1] tracking-[-0.045em]"
			>
				{t("settings.sound.title")}
			</h2>
			<p className="mt-1 text-muted">{t("settings.sound.description")}</p>
			<div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_3.5rem_auto] items-center gap-x-3 gap-y-2">
				{volumes.map(({ level, muted, mute }) => {
					const label = t(`settings.sound.${level}`);
					return (
						<div key={level} className="contents">
							<span className="text-muted">{label}</span>
							<Slider
								label={label}
								min={0}
								max={100}
								value={settings[level]}
								onChange={(value) => update({ [level]: value })}
								format={format}
							/>
							<span
								aria-hidden="true"
								className={`text-right tabular-nums ${settings[muted] ? "text-muted" : "text-text"}`}
							>
								{format(settings[level])}
							</span>
							<IconButton
								label={t(`settings.sound.${mute}`)}
								icon={settings[muted] ? VolumeX : Volume2}
								aria-pressed={settings[muted]}
								onClick={() => update({ [muted]: !settings[muted] })}
							/>
						</div>
					);
				})}
			</div>
		</section>
	);
}
