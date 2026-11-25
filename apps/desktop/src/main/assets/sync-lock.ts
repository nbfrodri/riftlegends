import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readdir, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";

const lockName =
	/^sync-([1-9]\d{0,9})-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const maxWaitMs = 5 * 60_000;
// A live pid can be a reused one; a claim this old is not a running sync.
const staleAfterMs = 60 * 60_000;

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// Permission errors still mean the process may own the cache.
		if (hasCode(error, "ESRCH")) return false;
		if (hasCode(error, "EPERM") || hasCode(error, "EACCES")) return true;
		throw error;
	}
}

async function isStale(path: string): Promise<boolean> {
	try {
		return Date.now() - (await stat(path)).mtimeMs > staleAfterMs;
	} catch (error) {
		if (hasCode(error, "ENOENT")) return true;
		throw error;
	}
}

async function removeClaim(path: string): Promise<void> {
	try {
		await rmdir(path);
	} catch (error) {
		if (!hasCode(error, "ENOENT")) throw error;
	}
}

async function hasOtherOwner(root: string, ownClaim: string): Promise<boolean> {
	let busy = false;
	for (const entry of await readdir(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === ownClaim) continue;
		const match = lockName.exec(entry.name);
		if (!match) continue;
		const pid = Number(match[1]);
		if (pid > 2_147_483_647) continue;
		if (isAlive(pid) && !(await isStale(join(root, entry.name)))) {
			busy = true;
		} else {
			await removeClaim(join(root, entry.name));
		}
	}
	return busy;
}

// Contenders of this process queue here instead of racing for the claim: two
// claimants that see each other both back off, and each retry costs 75-150 ms
// (tens of seconds on a slow Windows disk, #557). The claim directory then
// only arbitrates between processes.
const queues = new Map<string, Promise<unknown>>();

export async function acquireSyncLock(
	root: string,
): Promise<() => Promise<void>> {
	const previous = queues.get(root) ?? Promise.resolve();
	let leave = () => {};
	const turn = new Promise<void>((resolve) => {
		leave = resolve;
	});
	const tail = previous.then(() => turn);
	queues.set(root, tail);
	const leaveQueue = () => {
		leave();
		if (queues.get(root) === tail) queues.delete(root);
	};
	await previous;
	try {
		const release = await claimSyncLock(root);
		return async () => {
			try {
				await release();
			} finally {
				leaveQueue();
			}
		};
	} catch (error) {
		leaveQueue();
		throw error;
	}
}

async function claimSyncLock(root: string): Promise<() => Promise<void>> {
	const name = `sync-${process.pid}-${randomUUID()}`;
	const path = join(root, name);
	const deadline = performance.now() + maxWaitMs;
	do {
		if (!(await hasOtherOwner(root, name))) {
			await mkdir(path);
			// Publish before checking again: the later claimant must see the earlier
			// one, or both will back off. Unique names make stale removal safe when
			// more than one contender observes the same dead process.
			let acquired = false;
			try {
				acquired = !(await hasOtherOwner(root, name));
				if (acquired) return () => removeClaim(path);
			} finally {
				if (!acquired) await removeClaim(path);
			}
		}
		// Stagger retries after a collision. A delayed live owner keeps its claim.
		await setTimeout(randomInt(75, 150), undefined, { ref: false });
	} while (performance.now() < deadline);
	throw new Error("Asset cache is busy");
}
