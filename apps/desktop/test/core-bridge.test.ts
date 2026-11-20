import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CoreProcess, createCoreBridge } from "../src/main/core-bridge";

class FakeCore extends EventEmitter implements CoreProcess {
	readonly posted: { id: number; op: string; body?: string }[] = [];
	killed = false;
	postMessage(message: { id: number; op: string; body?: string }) {
		this.posted.push(message);
	}
	kill() {
		this.killed = true;
		this.emit("exit", 9);
		return true;
	}
	reply(index: number, result: unknown) {
		const request = this.posted[index];
		if (!request) throw new Error(`no request ${index}`);
		this.emit("message", { id: request.id, result });
	}
}

const ok = (facts: unknown[]) => ({ ok: true, position: facts.length, facts });

function setup(timeoutMs = 1000) {
	const cores: FakeCore[] = [];
	const bridge = createCoreBridge({
		spawn: () => {
			const core = new FakeCore();
			cores.push(core);
			return core;
		},
		timeoutMs,
	});
	const current = () => {
		const core = cores.at(-1);
		if (!core) throw new Error("no core");
		return core;
	};
	return { bridge, cores, current };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("start (P1)", () => {
	it("holds requests until the process has spawned", async () => {
		const { bridge, current } = setup();
		const answer = bridge.send("{}");
		expect(current().posted).toEqual([]);
		current().emit("spawn");
		expect(current().posted).toEqual([{ id: 1, op: "send", body: "{}" }]);
		current().reply(0, ok([]));
		await expect(answer).resolves.toEqual(ok([]));
	});
});

describe("restart (P4)", () => {
	it("fails pending requests with core-restarted and starts a new process", async () => {
		const { bridge, cores, current } = setup();
		current().emit("spawn");
		const pending = bridge.send("{}");
		current().emit("exit", 9);
		await expect(pending).resolves.toEqual({
			ok: false,
			error: { code: "core-restarted", params: {} },
		});
		expect(cores).toHaveLength(2);
		current().emit("spawn");
		const next = bridge.open();
		current().reply(0, { ok: true, sessionId: 1 });
		await expect(next).resolves.toEqual({ ok: true, sessionId: 1 });
	});

	it("does not restart after dispose", () => {
		const { bridge, cores, current } = setup();
		current().emit("spawn");
		bridge.dispose();
		expect(current().killed).toBe(true);
		expect(cores).toHaveLength(1);
	});
});

describe("facts (P5)", () => {
	it("reach every subscriber once and in order", async () => {
		const { bridge, current } = setup();
		current().emit("spawn");
		const first: unknown[] = [];
		const second: unknown[] = [];
		bridge.subscribe((facts) => first.push(...facts));
		const stop = bridge.subscribe((facts) => second.push(...facts));

		const a = bridge.send("a");
		const b = bridge.send("b");
		current().reply(0, ok([{ position: 0 }]));
		await a;
		stop();
		current().reply(1, ok([{ position: 1 }, { position: 2 }]));
		await b;

		expect(first).toEqual([{ position: 0 }, { position: 1 }, { position: 2 }]);
		expect(second).toEqual([{ position: 0 }]);
	});

	it("are not sent for rejected commands", async () => {
		const { bridge, current } = setup();
		current().emit("spawn");
		const seen = vi.fn();
		bridge.subscribe(seen);
		const answer = bridge.send("x");
		current().reply(0, {
			ok: false,
			error: { code: "invalid-command", params: {} },
		});
		await answer;
		expect(seen).not.toHaveBeenCalled();
	});
});

describe("timeout (P6)", () => {
	it("fails a request with core-timeout and restarts the stuck process", async () => {
		const { bridge, cores, current } = setup(500);
		current().emit("spawn");
		const stuck = bridge.send("loop");
		vi.advanceTimersByTime(500);
		await expect(stuck).resolves.toEqual({
			ok: false,
			error: { code: "core-timeout", params: {} },
		});
		expect(cores[0]?.killed).toBe(true);
		expect(cores).toHaveLength(2);
	});

	it("ignores a late reply after the timeout", async () => {
		const { bridge, cores } = setup(500);
		const first = cores[0] as FakeCore;
		first.emit("spawn");
		const stuck = bridge.send("loop");
		vi.advanceTimersByTime(500);
		await stuck;
		expect(() => first.reply(0, ok([{ position: 0 }]))).not.toThrow();
	});
});
