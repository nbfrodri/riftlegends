import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Separate from timed trials. Keep just input and compositor events plus the
// thread/process names needed to navigate the trace in Perfetto.
export async function traceConfirmation(page, path, exercise) {
	const cdp = await page.context().newCDPSession(page);
	const events = [];
	cdp.on("Tracing.dataCollected", ({ value }) => {
		for (const event of value) {
			if (
				!/EventLatency|InputLatency|FramePresented|PipelineReporter|BeginFrame|DrawAndSwap|^s1-|^process_name$|^thread_name$/.test(
					event.name,
				)
			)
				continue;
			events.push(event);
		}
	});
	await cdp.send("Tracing.start", {
		categories: "benchmark,cc,viz,input,latencyInfo,blink.user_timing",
		transferMode: "ReportEvents",
	});
	await page.evaluate(() => {
		document
			.querySelector(".hero-caption button")
			.addEventListener("pointerdown", () => performance.mark("s1-confirm"), {
				once: true,
			});
	});
	await exercise();
	const done = new Promise((resolve) =>
		cdp.once("Tracing.tracingComplete", resolve),
	);
	await cdp.send("Tracing.end");
	await done;
	await cdp.detach();
	writeFileSync(path, gzipSync(JSON.stringify({ traceEvents: events })));
}
