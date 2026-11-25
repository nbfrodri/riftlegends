import { useEffect } from "react";
import { useOptionalAssets } from "../assets";
import { playSound, preloadSounds } from ".";

const BUTTON = 'button, [role="button"]';
/** Buttons that already have their own sound (pool tiles, draft Confirm). */
const SILENT = "[data-silent-click]";

const disabled = (button: Element) =>
	button.matches(":disabled") || button.getAttribute("aria-disabled") === "true";

/**
 * One listener on the document plays the click for every button in the app
 * (#493), so no button mounts anything of its own (S1). Disabled buttons and
 * those marked `data-silent-click` stay quiet: they play their own sound.
 */
export function ButtonClickSound() {
	const sounds = useOptionalAssets()?.sounds;
	useEffect(() => preloadSounds(sounds), [sounds]);
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const button = (event.target as Element | null)?.closest?.(BUTTON);
			if (button && !disabled(button) && !button.matches(SILENT))
				playSound("click");
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);
	return null;
}
