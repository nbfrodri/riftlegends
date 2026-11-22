import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realLogosSchema } from "@rift-legends/contracts/real-logos";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "./client.ts";
import {
	buildLogos,
	matchTeam,
	parseApiTeams,
	teamsUrl,
	writeLogos,
} from "./logos.ts";

const fixture = JSON.parse(
	await readFile(
		new URL("./fixtures/lolesports/getTeams.json", import.meta.url),
		"utf8",
	),
);
const apiTeams = parseApiTeams(fixture);
const png = Buffer.concat([
	Buffer.from("89504e470d0a1a0a", "hex"),
	Buffer.from("logo"),
]);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const team = (id: string, short: string | undefined, league: string) => ({
	id,
	name: id,
	short,
	league,
});

describe("matchTeam", () => {
	const slugOf = (t: ReturnType<typeof team>) => {
		const match = matchTeam(t, apiTeams);
		return typeof match === "string" ? match : match.slug;
	};
	it("matches by code inside the league", () => {
		expect(slugOf(team("T1", "T1", "LCK"))).toBe("t1");
		expect(slugOf(team("KT Rolster", "KT", "LCK"))).toBe("kt-rolster");
	});
	it("prefers the active team over an archived one", () => {
		expect(slugOf(team("RED Canids", "RED", "CBLOL"))).toBe("red-kalunga");
	});
	it("falls back to the name when the code differs", () => {
		expect(slugOf(team("Dplus KIA", "XX", "LCK"))).toBe("dwg-kia");
	});
	it("uses the explicit alias", () => {
		expect(slugOf(team("Team Liquid", "TL", "LCS"))).toBe("team-liquid");
	});
	it("never matches a team of another league or an ambiguous one", () => {
		expect(slugOf(team("T1", "T1", "LEC"))).toBe("no team in the league");
		const t1 = apiTeams.find(
			({ slug }) => slug === "t1",
		) as (typeof apiTeams)[0];
		const twins = [
			{ ...t1, slug: "a" },
			{ ...t1, slug: "b" },
		];
		expect(matchTeam(team("T1", "T1", "LCK"), twins)).toBe("ambiguous");
	});
});

describe("parseApiTeams", () => {
	it("rejects other shapes", () => {
		expect(() => parseApiTeams({})).toThrow();
		expect(() => parseApiTeams({ data: { teams: [{ slug: 1 }] } })).toThrow();
	});
});

let cacheDir: string;
beforeEach(async () => {
	cacheDir = await mkdtemp(join(tmpdir(), "rift-logos-"));
});
afterEach(async () => rm(cacheDir, { recursive: true, force: true }));

function setup(imageFor: (url: string) => Response) {
	let now = 0;
	const sleeps: number[] = [];
	const calls: { url: string; init?: RequestInit | undefined }[] = [];
	const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
		const url = String(input);
		calls.push({ url, init });
		return url === teamsUrl ? Response.json(fixture) : imageFor(url);
	});
	const client = new Client({
		cacheDir,
		fetch,
		now: () => now,
		sleep: async (ms) => {
			sleeps.push(ms);
			now += ms;
		},
	});
	return { client, calls, sleeps };
}

describe("buildLogos", () => {
	const teams = [
		team("T1", "T1", "LCK"),
		team("KT Rolster", "KT", "LCK"),
		team("Team Liquid", "TL", "LCS"),
		team("Nobody", "NOB", "LCK"),
	];

	it("downloads each logo once, politely, and sorts the result", async () => {
		const { client, calls, sleeps } = setup(
			() => new Response(png, { headers: { "content-length": "12" } }),
		);
		const result = await buildLogos(client, [...teams].reverse());
		expect(result.logos.map((logo) => logo.team)).toEqual([
			"KT Rolster",
			"T1",
			"Team Liquid",
		]);
		expect(result.logos[0]).toEqual({
			team: "KT Rolster",
			url: "https://static.lolesports.com/teams/kt_darkbackground.png",
			sha256: sha(png),
			size: png.length,
			mime: "image/png",
		});
		expect(result.unmatched).toEqual([
			{ team: "Nobody", league: "LCK", reason: "no team in the league" },
		]);
		const headers = (index: number) =>
			new Headers(calls[index]?.init?.headers as HeadersInit);
		expect(headers(0).get("user-agent")).toBe("RiftLegendsDataPipeline/0.1");
		expect(headers(0).get("x-api-key")).toBeTruthy();
		expect(headers(1).get("user-agent")).toBe("RiftLegendsDataPipeline/0.1");
		expect(headers(1).get("x-api-key")).toBeNull();
		expect(calls.every((c) => c.init?.redirect === "error")).toBe(true);
		expect(calls.every((c) => c.url.startsWith("https://"))).toBe(true);
		expect(sleeps.length).toBe(calls.length - 1);
		expect(sleeps.every((ms) => ms === 1000)).toBe(true);
		expect(
			realLogosSchema.safeParse({
				provenance: {
					source: "lolesports.com",
					endpoint: teamsUrl,
					retrievedAt: result.retrievedAt,
					note: "x",
				},
				logos: result.logos,
			}).success,
		).toBe(true);
	});

	it("leaves out teams whose image fails, is not an image or is too large", async () => {
		const { client } = setup((url) => {
			if (url.includes("kt_dark")) return new Response("", { status: 403 });
			if (url.includes("1726801573959"))
				return new Response("<!doctype html>", { status: 200 });
			return new Response(Buffer.alloc(600 * 1024));
		});
		const result = await buildLogos(client, teams.slice(0, 3));
		expect(result.logos).toEqual([]);
		expect(result.unmatched.map((u) => u.team).sort()).toEqual([
			"KT Rolster",
			"T1",
			"Team Liquid",
		]);
		expect(result.unmatched.find((u) => u.team === "T1")?.reason).toMatch(
			/PNG, JPEG or WebP/,
		);
	});

	it("leaves out teams whose logo is an SVG", async () => {
		const { client } = setup(() => new Response(png));
		const svg = parseApiTeams({
			data: {
				teams: [
					{
						slug: "w",
						name: "W",
						code: "W",
						image: "http://static.lolesports.com/teams/w.svg",
						status: "active",
						homeLeague: { name: "LCK" },
					},
				],
			},
		});
		expect(matchTeam(team("W", "W", "LCK"), svg)).toBe(svg[0]);
		const result = await buildLogos(
			Object.assign(client, { get: async () => svg }),
			[team("W", "W", "LCK")],
		);
		expect(result.unmatched[0]?.reason).toBe("no usable logo URL");
	});

	it("reuses the cache offline", async () => {
		const first = setup(() => new Response(png));
		await buildLogos(first.client, teams.slice(0, 1));
		const offline = new Client({
			cacheDir,
			offline: true,
			fetch: vi.fn<typeof globalThis.fetch>(() => {
				throw new Error("network");
			}),
		});
		const again = await buildLogos(offline, teams.slice(0, 1));
		expect(again.logos).toHaveLength(1);
	});
});

describe("writeLogos", () => {
	it("writes a validated, deterministic logos.json next to the snapshots", async () => {
		const out = join(cacheDir, "real");
		await mkdir(out);
		const snapshot = JSON.parse(
			await readFile(
				new URL("../../packages/core/content/real/lck.json", import.meta.url),
				"utf8",
			).catch(() => "null"),
		);
		expect(snapshot).not.toBeNull();
		await writeFile(join(out, "lck.json"), JSON.stringify(snapshot));
		let now = 0;
		const run = () =>
			writeLogos({
				cacheDir: join(cacheDir, "raw"),
				outputDir: out,
				fetch: async (input) =>
					String(input) === teamsUrl
						? Response.json(fixture)
						: new Response(png),
				now: () => (now += 1000),
				sleep: async () => {},
			});
		const first = await run();
		const text = await readFile(join(out, "logos.json"), "utf8");
		const parsed = realLogosSchema.parse(JSON.parse(text));
		expect(parsed.logos.map((l) => l.team)).toEqual(
			[...parsed.logos.map((l) => l.team)].sort(),
		);
		expect(first.unmatched.length + first.logos).toBe(first.teams.length);
		await run();
		expect(await readFile(join(out, "logos.json"), "utf8")).toBe(text);
	});
});
