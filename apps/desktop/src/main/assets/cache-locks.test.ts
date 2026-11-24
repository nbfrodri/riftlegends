import { mkdir, readdir, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { useCacheFixture } from "./cache-test-kit";

describe("main asset cache locks", () => {
	const t = useCacheFixture();
	const { create } = t;
	const lock = (pid: number) =>
		join(
			t.profile,
			"assets",
			`sync-${pid}-00000000-0000-4000-8000-000000000000`,
		);

	it("D0 waits for a live cache owner before issuing any request", async () => {
		await mkdir(lock(process.pid), { recursive: true });
		const pending = create().sync();
		try {
			const result = await Promise.race([
				pending,
				new Promise((resolve) => setTimeout(resolve, 200, "waiting")),
			]);
			expect(result).toBe("waiting");
			expect(t.requests).toEqual([]);
		} finally {
			await rm(lock(process.pid), { recursive: true, force: true });
			await pending;
		}
		expect(await pending).toEqual({ state: "ready", version: t.version });
	});

	it("D0 reclaims a cache lock left by a dead process", async () => {
		const deadOwner = lock(2_147_483_647);
		await mkdir(deadOwner, { recursive: true });
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
		expect(await readdir(join(t.profile, "assets"))).toEqual(["cdragon"]);
	});

	it("D0 reclaims an old cache lock whose pid was reused", async () => {
		const old = lock(process.pid);
		await mkdir(old, { recursive: true });
		const past = new Date(Date.now() - 2 * 60 * 60_000);
		await utimes(old, past, past);
		expect(await create().sync()).toEqual({
			state: "ready",
			version: t.version,
		});
	});
});
