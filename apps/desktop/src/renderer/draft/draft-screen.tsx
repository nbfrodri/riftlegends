import { PageHeader } from "./page-header";
import { DraftSessionProvider, useDraftSession } from "./session";
import { draftStages, stageOf } from "./stages";

function DraftFlow() {
	const { view, presentation } = useDraftSession();
	const stage = stageOf(view, presentation);
	const Stage = draftStages[stage];
	return (
		<section className="flex min-h-full flex-col gap-gap px-gutter py-[clamp(16px,2.5vh,26px)]">
			{stage !== "match" && <PageHeader stage={stage} />}
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
