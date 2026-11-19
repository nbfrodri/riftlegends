import { useEffect, useState } from "react";
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

export function TitleBar({ controls }: { controls: WindowControls }) {
	const [maximized, setMaximized] = useState(false);
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

	const toggleLabel = maximized ? "Restore" : "Maximize";
	return (
		<header className="title-bar">
			<div className="title-bar-brand">
				<img src="./icon-small.svg" alt="" width="16" height="16" />
				<span>Rift Legends</span>
			</div>
			<div className="title-bar-controls">
				<button
					type="button"
					aria-label="Minimize"
					title="Minimize"
					onClick={() => void controls.minimize()}
				>
					<Glyph path="M5 12h14" />
				</button>
				<button
					type="button"
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
					aria-label="Close"
					title="Close"
					onClick={() => void controls.close()}
				>
					<Glyph path="M5 5l14 14 M19 5 5 19" />
				</button>
			</div>
		</header>
	);
}
