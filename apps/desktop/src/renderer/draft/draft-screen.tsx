import { BroadcastScene } from "./broadcast/scene";
import { PageHeader } from "./page-header";
import { DraftSessionProvider, useDraftSession } from "./session";
import { draftStages, stageOf } from "./stages";
import { TurnControls } from "./turn-controls";

function DraftFlow() {
	const { view, presentation } = useDraftSession();
	const stage = stageOf(view, presentation);
	const Stage = draftStages[stage];
	return (
		<section className="flex min-h-full flex-col gap-gap px-gutter py-[clamp(16px,2.5vh,26px)] short:gap-3 short:py-3.5">
			{stage !== "match" && (
				<PageHeader stage={stage}>
					{(stage === "side" || stage === "draft" || stage === "roles") && (
						<div className="flex min-w-0 items-center justify-end gap-4">
							<BroadcastScene />
							<TurnControls />
						</div>
					)}
				</PageHeader>
			)}
			<Stage />
		</section>
	);
}

/** The `/draft` route: one session, and the sub-screen of the current stage. */
export function DraftScreen() {
	return (
		<DraftSessionProvider>
			<DraftFlow />
		</DraftSessionProvider>
	);
}
