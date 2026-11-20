const { join } = require("node:path");
const { utilityProcess } = require("electron");

function openWriter(file) {
	const child = utilityProcess.fork(join(__dirname, "writer.cjs"), [file]);
	let pending;
	let exited = false;
	let killed;
	const exit = new Promise((resolve) =>
		child.once("exit", (code) => {
			exited = true;
			if (pending) {
				if (killed) pending.resolve({ ...killed, exitCode: code });
				else pending.reject(Error(`Writer exited before replying: ${code}`));
			}
			resolve(code);
		}),
	);
	child.on("message", (message) => {
		if (!pending) return;
		if (message.atCut && pending.cut === message.atCut) {
			killed = { atCut: message.atCut, pid: child.pid };
			process.kill(child.pid, "SIGKILL");
			return;
		}
		if (message.error) pending.reject(Error(message.error));
		else pending.resolve(message.value);
		pending = undefined;
	});
	return {
		request(command) {
			if (pending || exited) throw Error("Writer busy or closed");
			return new Promise((resolve, reject) => {
				pending = { resolve, reject, cut: command.cut };
				child.postMessage(command);
			});
		},
		async close() {
			if (!exited) child.postMessage({ op: "close" });
			const code = await exit;
			if (!killed && code !== 0) throw Error(`Writer close failed: ${code}`);
		},
	};
}
module.exports = { openWriter };
