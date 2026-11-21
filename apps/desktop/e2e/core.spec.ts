import type { ElectronApplication } from "@playwright/test";
import { CONTRACT_VERSION } from "@rift-legends/contracts";
import { packagedDraftContent } from "@rift-legends/core";
import { expect, launchApp, test } from "./fixtures";

// Drives the real core utilityProcess through main's bridge (plan 04, P1/P4).
type Bridge = {
	open(): Promise<{ ok: boolean; sessionId?: number }>;
	send(body: string): Promise<unknown>;
	query(body: string): Promise<unknown>;
};
declare const riftCore: Bridge;

const tick = (sessionId: number, expectedPosition: number) =>
	JSON.stringify({
		v: CONTRACT_VERSION,
		kind: "debug.tick",
		sessionId,
		expectedPosition,
		payload: {},
	});

const open = async (app: ElectronApplication) => {
	const result = await app.evaluate(() => riftCore.open());
	if (!result.ok || result.sessionId === undefined)
		throw new Error("open failed");
	return result.sessionId;
};

const corePid = (app: ElectronApplication) =>
	app.evaluate(
		({ app }) =>
			app.getAppMetrics().find((p) => p.name === "Rift Legends core")?.pid,
	);

test("the core process answers, and comes back after being killed", async ({
	playwright,
}, testInfo) => {
	const app = await launchApp(
		{ playwright },
		{
			profileDir: testInfo.outputPath("profile"),
			systemLocale: "en-US",
			env: { RIFT_E2E_CORE: "1" },
		},
	);
	try {
		await app.firstWindow();
		const session = await open(app);
		expect(
			await app.evaluate((_, body) => riftCore.send(body), tick(session, 0)),
		).toEqual({
			ok: true,
			position: 1,
			facts: [{ type: "debug.ticked", position: 0, count: 1 }],
		});

		const pid = await corePid(app);
		expect(pid).toBeGreaterThan(0);
		process.kill(pid as number, "SIGKILL");
		await expect.poll(() => corePid(app)).not.toBe(pid);

		// The session lived in memory, so the new core does not know it.
		expect(
			await app.evaluate((_, body) => riftCore.send(body), tick(session, 1)),
		).toMatchObject({
			ok: false,
			error: { code: "unknown-session" },
		});
		const fresh = await open(app);
		expect(
			await app.evaluate((_, body) => riftCore.send(body), tick(fresh, 0)),
		).toMatchObject({
			ok: true,
			position: 1,
		});
	} finally {
		await app.close();
	}
});

test("the core process opens draft sessions with the packaged content", async ({
	playwright,
}, testInfo) => {
	const app = await launchApp(
		{ playwright },
		{
			profileDir: testInfo.outputPath("profile"),
			systemLocale: "en-US",
			env: { RIFT_E2E_CORE: "1" },
		},
	);
	try {
		await app.firstWindow();
		const sessionId = await open(app);
		const message = (kind: string, rest: object) =>
			JSON.stringify({ v: CONTRACT_VERSION, kind, sessionId, ...rest });
		const start = message("series.start", {
			expectedPosition: 0,
			payload: {
				teams: ["forge", "shoal"],
				seeds: [1, 2],
				format: "bo1",
				fearless: "off",
				timer: false,
				pool: packagedDraftContent.champions.map((c) => c.id),
				seed: 1,
				ai: [null, "coach"],
			},
		});
		expect(
			await app.evaluate((_, body) => riftCore.send(body), start),
		).toMatchObject({ ok: true, position: 1 });
		const view = message("match.view", { params: { game: 1 } });
		expect(
			await app.evaluate((_, body) => riftCore.query(body), view),
		).toMatchObject({ ok: false, error: { code: "game-not-played" } });
	} finally {
		await app.close();
	}
});
