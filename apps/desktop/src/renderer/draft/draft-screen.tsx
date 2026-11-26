import type { DraftView } from "@rift-legends/contracts";
import { useEffect, useRef } from "react";
import { useOptionalAssets } from "../assets";
import { playSound, preloadSounds } from "../sound";
import { draftSounds } from "../sound/draft-sounds";
import { BroadcastScene } from "./broadcast/scene";
import { PageHeader } from "./page-header";
import { DraftSessionProvider, useDraftSession } from "./session";
import { draftStages, stageOf } from "./stages";
import { TurnControls } from "./turn-controls";

/**
 * Plays the sound of each ban and pick as it lands (#472). It lives above the
 * stages so the last pick sounds even though Roles replaces the board.
 */
function useDraftSounds(view: DraftView | null, mine: string | null) {
	const previous = useRef<DraftView | null>(null);
	useEffect(() => {
		if (view)
			for (const id of draftSounds(previous.current, view, mine)) playSound(id);
		previous.current = view;
	}, [view, mine]);
}

/** The sub-screen of the current stage, under a draft or season series provider. */
export function DraftFlow() {
	const { view, presentation, mine } = useDraftSession();
	useDraftSounds(view, mine);
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
	const sounds = useOptionalAssets()?.sounds;
	// Decoded before the board needs them: playing then never waits.
	useEffect(() => preloadSounds(sounds), [sounds]);
	return (
		<DraftSessionProvider>
			<DraftFlow />
		</DraftSessionProvider>
	);
}
