import { createI18n } from "@rift-legends/i18n";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { createAppRouter } from "./router";
import { TitleBar } from "./title-bar";

async function start(root: HTMLElement) {
	const i18n = await createI18n(await window.riftlegends.systemLocale());
	document.documentElement.lang = i18n.language;
	createRoot(root).render(
		<I18nextProvider i18n={i18n}>
			<div className="flex h-dvh flex-col">
				<TitleBar controls={window.riftlegends.window} />
				<RouterProvider router={createAppRouter()} />
			</div>
		</I18nextProvider>,
	);
}

const root = document.getElementById("root");
if (root) void start(root);
