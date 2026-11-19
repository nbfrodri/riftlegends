import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WindowControls } from "../shared/bridge";

function Glyph({ path }: { path: string }) {
	return (
		<svg
			aria-hidden="true"
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.65"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={path} />
		</svg>
	);
}

const controlButton =
	"grid h-full w-11 cursor-default place-items-center text-muted [app-region:no-drag] hover:bg-surface hover:text-text";

export function TitleBar({ controls }: { controls: WindowControls }) {
	const { t } = useTranslation();
	const [maximized, setMaximized] = useState(false);
	const [canMinimize, setCanMinimize] = useState(false);
	useEffect(() => {
		let active = true;
		void controls.canMinimize().then((supported) => {
			if (active) setCanMinimize(supported);
		});
		return () => {
			active = false;
		};
	}, [controls]);
	useEffect(() => {
		let acceptInitialState = true;
		const unsubscribe = controls.onMaximizedChange((state) => {
			acceptInitialState = false;
			setMaximized(state);
		});
		void controls.isMaximized().then((initial) => {
			if (acceptInitialState) setMaximized(initial);
		});
		return () => {
			acceptInitialState = false;
			unsubscribe();
		};
	}, [controls]);

	const toggleLabel = t(
		maximized ? "shell.window.restore" : "shell.window.maximize",
	);
	const minimizeLabel = t("shell.window.minimize");
	const closeLabel = t("shell.window.close");
	// app-region: Electron turns the bar into the native caption (move and
	// double-click) and swallows its pointer events; the buttons opt out.
	return (
		<header className="sticky top-0 z-10 flex h-8 items-center justify-between border-line border-b bg-canvas font-bold font-display text-[12px] text-text leading-none tracking-[-0.02em] select-none [app-region:drag]">
			<div className="ms-4 flex items-center gap-2">
				<img
					className="block"
					src="./icon-small.svg"
					alt=""
					width="16"
					height="16"
				/>
				<span>{t("shell.title")}</span>
			</div>
			<div className="flex h-full [app-region:no-drag]">
				{canMinimize && (
					<button
						type="button"
						className={controlButton}
						aria-label={minimizeLabel}
						title={minimizeLabel}
						onClick={() => void controls.minimize()}
					>
						<Glyph path="M5 12h14" />
					</button>
				)}
				<button
					type="button"
					className={controlButton}
					aria-label={toggleLabel}
					title={toggleLabel}
					onClick={() => void controls.toggleMaximize()}
				>
					<Glyph
						path={maximized ? "M8 8V4h12v12h-4 M4 8h12v12H4z" : "M5 5h14v14H5z"}
					/>
				</button>
				<button
					type="button"
					className={controlButton}
					aria-label={closeLabel}
					title={closeLabel}
					onClick={() => void controls.close()}
				>
					<Glyph path="M5 5l14 14 M19 5 5 19" />
				</button>
			</div>
		</header>
	);
}
