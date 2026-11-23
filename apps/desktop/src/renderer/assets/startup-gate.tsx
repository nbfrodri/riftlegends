import { Button } from "@rift-legends/ui-kit/components/button";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import champions from "../../../../../packages/core/content/real/champions/champions.json";
import { appContent } from "../content-set";
import { useAssets } from ".";
import { Progress } from "./content-settings";

export function StartupGate({ children }: { children: ReactNode }) {
	return appContent() === "fictional" ? (
		children
	) : (
		<RealStartup>{children}</RealStartup>
	);
}

function RealStartup({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const { status, champions: catalog, catalogPending, sync } = useAssets();
	const [entered, setEntered] = useState(false);
	if (!entered && catalog) {
		const known = new Set(catalog.map((c) => c.id));
		if (champions.every((c) => known.has(c.id))) setEntered(true);
	}
	const failure =
		status?.state === "missing" ||
		status?.state === "error" ||
		(status?.state === "ready" && !catalogPending);
	return (
		<>
			{entered && children}
			<main
				hidden={entered}
				inert={entered}
				className="startup-screen absolute inset-x-0 top-8 bottom-0 z-10 grid place-items-center bg-canvas p-gutter"
			>
				<section className="w-full max-w-md border border-line bg-panel p-8">
					<div className="flex items-center gap-3">
						<img src="./icon-small.svg" alt="" width="48" height="48" />
						<h1 className="font-display text-3xl font-bold tracking-heading">
							{t("shell.title")}
						</h1>
					</div>
					<div className="mt-6 border-t border-line pt-5">
						<p role="status" className="font-semibold">
							{t(
								failure
									? "startup.connection"
									: status?.state === "syncing" && status.progress.total > 0
										? "settings.content.syncing"
										: "startup.loading",
							)}
						</p>
						{failure ? (
							<Button className="mt-4" onClick={sync}>
								{t("settings.content.retry")}
							</Button>
						) : status?.state === "syncing" && status.progress.total > 0 ? (
							<Progress {...status.progress} />
						) : (
							<div
								role="progressbar"
								aria-label={t("startup.loading")}
								className="mt-3 h-1.5 overflow-hidden bg-line"
							>
								<div className="startup-progress h-full w-1/4 bg-action" />
							</div>
						)}
					</div>
				</section>
			</main>
		</>
	);
}
