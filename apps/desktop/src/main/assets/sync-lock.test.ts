import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireSyncLock } from "./sync-lock";

describe("acquireSyncLock", () => {
	let root = "";
	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "rift-lock-"));
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	// #557: contenders of one process used to collide on the filesystem claim
	// and back off 75-150 ms each round, which on a slow Windows disk added up
	// to tens of seconds.
	it("hands the lock to same-process contenders without a retry delay", async () => {
		const order: number[] = [];
		const started = performance.now();
		await Promise.all(
			[1, 2, 3, 4].map(async (id) => {
				const release = await acquireSyncLock(root);
				order.push(id);
				await release();
			}),
		);
		expect(order).toEqual([1, 2, 3, 4]);
		expect(performance.now() - started).toBeLessThan(70);
	});
});
