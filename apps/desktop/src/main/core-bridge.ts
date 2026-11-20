import type { CoreError } from "@rift-legends/contracts";
import type { HostReply, HostRequest, HostResult } from "../core-host/host";

/** The parts of Electron's UtilityProcess the bridge uses. */
export interface CoreProcess {
	postMessage(message: HostRequest): void;
	on(event: "spawn", listener: () => void): unknown;
	on(event: "exit", listener: (code: number) => void): unknown;
	on(event: "message", listener: (message: HostReply) => void): unknown;
	kill(): boolean;
}

type Fact = { position: number };
type Listener = (facts: readonly Fact[]) => void;

interface Pending {
	resolve(result: HostResult): void;
	timer: ReturnType<typeof setTimeout>;
}

const failure = (code: CoreError["code"]): HostResult => ({
	ok: false,
	error: { code, params: {} },
});

/**
 * Main's side of the core: starts the process, pairs each request with its
 * reply, restarts the process when it dies or hangs, and hands the facts of
 * every accepted command to the subscribers. Requests never reject: failures
 * come back as `{ ok: false, error }`, like the core's own.
 */
export const createCoreBridge = (options: {
	spawn: () => CoreProcess;
	timeoutMs: number;
}) => {
	const pending = new Map<number, Pending>();
	const listeners = new Set<Listener>();
	let nextId = 1;
	let disposed = false;
	let core: CoreProcess;
	let ready = false;
	let queue: HostRequest[] = [];

	const settle = (id: number, result: HostResult) => {
		const entry = pending.get(id);
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		entry.resolve(result);
	};

	const start = () => {
		const current = options.spawn();
		core = current;
		ready = false;
		current.on("spawn", () => {
			if (core !== current) return;
			ready = true;
			for (const request of queue) current.postMessage(request);
			queue = [];
		});
		current.on("message", ({ id, result }) => {
			if (core !== current || id === null) return;
			if (!pending.has(id)) return;
			settle(id, result);
			if (result.ok && "facts" in result && result.facts.length > 0) {
				for (const listener of [...listeners]) listener(result.facts);
			}
		});
		current.on("exit", () => {
			if (core !== current) return;
			for (const id of [...pending.keys()])
				settle(id, failure("core-restarted"));
			queue = [];
			if (!disposed) start();
		});
	};

	const request = (message: HostRequest) =>
		new Promise<HostResult>((resolve) => {
			const timer = setTimeout(() => {
				settle(message.id, failure("core-timeout"));
				// A stuck core blocks every session: replace it.
				core.kill();
			}, options.timeoutMs);
			pending.set(message.id, { resolve, timer });
			if (ready) core.postMessage(message);
			else queue.push(message);
		});

	start();

	return {
		open: () => request({ id: nextId++, op: "open" }),
		send: (body: string) => request({ id: nextId++, op: "send", body }),
		query: (body: string) => request({ id: nextId++, op: "query", body }),
		subscribe(listener: Listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		dispose() {
			disposed = true;
			core.kill();
		},
	};
};

export type CoreBridge = ReturnType<typeof createCoreBridge>;
