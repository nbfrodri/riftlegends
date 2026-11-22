import { createI18n } from "@rift-legends/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { AssetsProvider } from "./assets";
import { CoreProvider } from "./core";
import { CoreProbe } from "./core/probe";
import { initialLocale } from "./language";
import { createAppRouter } from "./router";
import { TitleBar } from "./title-bar";

// Set by main only in the E2E runs of plan 04.
const probe =
	new URLSearchParams(window.location.search).get("probe") === "core";

async function start(root: HTMLElement) {
	const locale = await initialLocale(() => window.riftlegends.systemLocale());
	const i18n = await createI18n(locale);
	document.documentElement.lang = i18n.language;
	createRoot(root).render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient()}>
				<CoreProvider api={window.riftlegends.core}>
					<AssetsProvider api={window.riftlegends.assets}>
						<div className="flex h-dvh flex-col">
							<TitleBar controls={window.riftlegends.window} />
							{probe && <CoreProbe />}
							<RouterProvider router={createAppRouter()} />
						</div>
					</AssetsProvider>
				</CoreProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	);
}

const root = document.getElementById("root");
if (root) void start(root);
