import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
	maxRiotImageBytes,
	sniffImageMime,
} from "@rift-legends/contracts/real-logos";

export interface ClientOptions {
	cacheDir: string;
	offline?: boolean;
	fetch?: typeof fetch;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	maxAttempts?: number;
}

export type CargoRow = Readonly<Record<string, string | null>>;
const cargoLimit = 500;
const cargoInterval = 11_000;
const lolesportsInterval = 1_000;
const userAgent = "RiftLegendsDataPipeline/0.1";

/**
 * lolesports.com's own public web client key, shipped in its website. It
 * identifies the site, not a person, and is not a secret.
 */
export const lolesportsApi = "https://esports-api.lolesports.com/persisted/gw";
const lolesportsKey = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const lolesportsHosts = new Set([
	"esports-api.lolesports.com",
	"static.lolesports.com",
	"lolstatic-a.akamaihd.net",
]);

export interface ImageDigest {
	sha256: string;
	size: number;
	mime: string;
}

class Permanent extends Error {}
export class OfflineCacheMiss extends Error {}

function requestHeaders(url: string): Record<string, string> {
	return new URL(url).hostname === "esports-api.lolesports.com"
		? { "User-Agent": userAgent, "x-api-key": lolesportsKey }
		: { "User-Agent": userAgent };
}

function interval(url: string) {
	const parsed = new URL(url);
	if (parsed.searchParams.get("action") === "cargoquery") return cargoInterval;
	return lolesportsHosts.has(parsed.hostname) ? lolesportsInterval : 0;
}

const readImage =
	(limit: number) =>
	async (response: Response): Promise<ImageDigest> => {
		const declared = Number(response.headers.get("content-length") ?? 0);
		if (declared > limit) throw new Permanent("Image is too large");
		const chunks: Uint8Array[] = [];
		let size = 0;
		for await (const chunk of response.body ?? []) {
			size += chunk.length;
			if (size > limit) throw new Permanent("Image is too large");
			chunks.push(chunk);
		}
		const bytes = Buffer.concat(chunks);
		const mime = sniffImageMime(bytes);
		if (!mime) throw new Permanent("Not a PNG, JPEG or WebP image");
		return {
			sha256: createHash("sha256").update(bytes).digest("hex"),
			size,
			mime,
		};
	};

function parseDigest(body: unknown): ImageDigest {
	const { sha256, size, mime } = (body ?? {}) as Partial<ImageDigest>;
	if (
		typeof sha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(sha256) ||
		!Number.isSafeInteger(size) ||
		typeof mime !== "string"
	)
		throw new Error("Invalid image digest");
	return { sha256, size: size as number, mime };
}

export function wikiUrl(params: Record<string, string>) {
	return `https://lol.fandom.com/api.php?${new URLSearchParams({ format: "json", maxlag: "5", ...params })}`;
}

export function cacheFile(cacheDir: string, url: string) {
	return join(
		cacheDir,
		`${createHash("sha256").update(url).digest("hex")}.json`,
	);
}

function retryAfter(value: string | null, now: number): number {
	if (!value) return 0;
	return /^\d+$/.test(value)
		? Number(value) * 1_000
		: Math.max(0, Date.parse(value) - now) || 0;
}

function cargoRows(body: unknown): CargoRow[] {
	const rows = (body as { cargoquery?: unknown } | null)?.cargoquery;
	if (!Array.isArray(rows) || rows.length > cargoLimit)
		throw new Error("Invalid Cargo response");
	return rows.map((entry) => {
		const row: unknown = entry?.title;
		if (
			!row ||
			typeof row !== "object" ||
			Array.isArray(row) ||
			Object.values(row).some(
				(value) => value !== null && typeof value !== "string",
			)
		) {
			throw new Error("Invalid Cargo row");
		}
		return row as CargoRow;
	});
}

export class Client {
	readonly queries = new Map<string, string>();
	readonly #fetch: typeof fetch;
	readonly #now: () => number;
	readonly #sleep: (milliseconds: number) => Promise<void>;
	readonly #maxAttempts: number;
	readonly #options: ClientOptions;
	#queue = { tail: Promise.resolve(), nextRequest: 0 };

	constructor(options: ClientOptions) {
		this.#options = options;
		this.#fetch = options.fetch ?? fetch;
		this.#now = options.now ?? Date.now;
		this.#sleep = options.sleep ?? delay;
		this.#maxAttempts = options.maxAttempts ?? 5;
		if (!Number.isSafeInteger(this.#maxAttempts) || this.#maxAttempts < 1) {
			throw new Error("maxAttempts must be a positive integer");
		}
	}

	/** Use a separate cache and query log while sharing the same rate limit. */
	withCache(cacheDir: string) {
		const client = new Client({ ...this.#options, cacheDir });
		client.#queue = this.#queue;
		return client;
	}

	async cargo(
		table: string,
		fields: string,
		where: string,
		orderBy: string,
		options: {
			join_on?: string;
			group_by?: string;
			/** Applied before caching, so the cache never keeps what it drops. */
			cacheRow?: (row: CargoRow) => CargoRow;
		} = {},
	): Promise<CargoRow[]> {
		const { cacheRow, ...params } = options;
		const rows: CargoRow[] = [];
		for (;;) {
			const url = wikiUrl({
				action: "cargoquery",
				tables: table,
				fields,
				where,
				order_by: orderBy,
				limit: String(cargoLimit),
				offset: String(rows.length),
				...params,
			});
			const page = cacheRow
				? await this.#enqueue(
						url,
						(body) => cargoRows(body).map(cacheRow),
						(response) => response.json(),
						(result) => ({ cargoquery: result.map((title) => ({ title })) }),
					)
				: await this.get(url, cargoRows);
			rows.push(...page);
			if (page.length < cargoLimit) return rows;
		}
	}

	/**
	 * SHA-256, size and type of an image, downloaded once and cached as
	 * metadata only: the bytes are never stored. Redirects are refused.
	 */
	imageDigest(
		url: string,
		limit: number = maxRiotImageBytes,
	): Promise<ImageDigest> {
		return this.#enqueue(url, parseDigest, readImage(limit));
	}

	/** `cacheBody` shrinks what is stored; `parse` must accept both shapes. */
	get<T>(
		url: string,
		parse: (body: unknown) => T,
		cacheBody?: (result: T) => unknown,
	): Promise<T> {
		return this.#enqueue(url, parse, (response) => response.json(), cacheBody);
	}

	#enqueue<T>(
		url: string,
		parse: (body: unknown) => T,
		read: (response: Response) => Promise<unknown>,
		cacheBody?: (result: T) => unknown,
	): Promise<T> {
		const request = this.#queue.tail.then(() =>
			this.#read(url, parse, read, cacheBody),
		);
		this.#queue.tail = request.then(
			() => {},
			() => {},
		);
		return request;
	}

	async #read<T>(
		url: string,
		parse: (body: unknown) => T,
		reader: (response: Response) => Promise<unknown>,
		cacheBody?: (result: T) => unknown,
	): Promise<T> {
		const file = cacheFile(this.#options.cacheDir, url);
		const cached = await readFile(file, "utf8").catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code !== "ENOENT") throw error;
			},
		);
		if (cached !== undefined) {
			const { retrievedAt, body } = JSON.parse(cached);
			if (
				typeof retrievedAt !== "string" ||
				!Number.isFinite(Date.parse(retrievedAt))
			) {
				throw new Error(`Invalid cache timestamp for ${url}`);
			}
			const result = parse(body);
			this.queries.set(url, retrievedAt);
			return result;
		}
		if (this.#options.offline)
			throw new OfflineCacheMiss(`Offline cache miss: ${url}`);
		const body = await this.#download(url, reader);
		const result = parse(body);
		const retrievedAt = new Date(this.#now()).toISOString();
		await mkdir(this.#options.cacheDir, { recursive: true, mode: 0o700 });
		const temp = `${file}.${randomUUID()}.tmp`;
		try {
			await writeFile(
				temp,
				JSON.stringify({
					retrievedAt,
					body: cacheBody ? cacheBody(result) : body,
				}),
				{
					mode: 0o600,
				},
			);
			await rename(temp, file);
		} finally {
			await rm(temp, { force: true });
		}
		this.queries.set(url, retrievedAt);
		return result;
	}

	async #download(
		url: string,
		reader: (response: Response) => Promise<unknown>,
	): Promise<unknown> {
		const spacing = interval(url);
		let nextAttempt = 0;
		let reason = "";
		for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
			const wait =
				Math.max(nextAttempt, spacing ? this.#queue.nextRequest : 0) -
				this.#now();
			if (wait > 0) await this.#sleep(wait);
			if (spacing) this.#queue.nextRequest = this.#now() + spacing;

			let retry = 0;
			try {
				const response = await this.#fetch(url, {
					headers: requestHeaders(url),
					redirect: lolesportsHosts.has(new URL(url).hostname)
						? "error"
						: "follow",
					signal: AbortSignal.timeout(30_000),
				});
				retry = retryAfter(response.headers.get("retry-after"), this.#now());
				if (response.ok) {
					const body = await reader(response);
					const apiError = (body as { error?: { code?: unknown } } | null)
						?.error?.code;
					if (!apiError) return body;
					reason = String(apiError);
					if (apiError !== "ratelimited" && apiError !== "maxlag") break;
				} else {
					await response.body?.cancel();
					reason = `HTTP ${response.status}`;
					if (response.status !== 429 && response.status < 500) break;
				}
			} catch (error) {
				if (error instanceof Permanent) throw error;
				reason =
					error instanceof Error && error.cause
						? `${error.message}: ${error.cause}`
						: String(error);
			}
			nextAttempt =
				this.#now() +
				Math.max(retry, Math.min(120_000, cargoInterval * 2 ** (attempt - 1)));
		}
		throw new Error(`Request failed (${reason}): ${url}`);
	}
}
