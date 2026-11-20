// Entry of the core's utilityProcess: the only authority over the sessions.
import { createDebugHost } from "./host";

const host = createDebugHost();

process.parentPort.on("message", (event) => {
	process.parentPort.postMessage(host.receive(event.data));
});
