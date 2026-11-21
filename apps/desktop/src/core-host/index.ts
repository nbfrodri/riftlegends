// Entry of the core's utilityProcess: the only authority over the sessions.
import { createCoreHost } from "./host";

const host = createCoreHost();

process.parentPort.on("message", (event) => {
	process.parentPort.postMessage(host.receive(event.data));
});
