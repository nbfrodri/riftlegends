import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

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
const userAgent = "RiftLegendsDataPipeline/0.1";

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
	#tail = Promise.resolve();
	#nextCargo = 0;

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

	async cargo(
		table: string,
		fields: string,
		where: string,
		orderBy: string,
	): Promise<CargoRow[]> {
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
			});
			const page = await this.get(url, cargoRows);
			rows.push(...page);
			if (page.length < cargoLimit) return rows;
		}
	}

	get<T>(url: string, parse: (body: unknown) => T): Promise<T> {
		const request = this.#tail.then(() => this.#read(url, parse));
		this.#tail = request.then(
			() => {},
			() => {},
		);
		return request;
	}

	async #read<T>(url: string, parse: (body: unknown) => T): Promise<T> {
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
		if (this.#options.offline) throw new Error(`Offline cache miss: ${url}`);
		const body = await this.#download(url);
		const result = parse(body);
		const retrievedAt = new Date(this.#now()).toISOString();
		await mkdir(this.#options.cacheDir, { recursive: true, mode: 0o700 });
		const temp = `${file}.${randomUUID()}.tmp`;
		try {
			await writeFile(temp, JSON.stringify({ retrievedAt, body }), {
				mode: 0o600,
			});
			await rename(temp, file);
		} finally {
			await rm(temp, { force: true });
		}
		this.queries.set(url, retrievedAt);
		return result;
	}

	async #download(url: string): Promise<unknown> {
		const cargo = new URL(url).searchParams.get("action") === "cargoquery";
		let nextAttempt = 0;
		let reason = "";
		for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
			const wait =
				Math.max(nextAttempt, cargo ? this.#nextCargo : 0) - this.#now();
			if (wait > 0) await this.#sleep(wait);
			if (cargo) this.#nextCargo = this.#now() + cargoInterval;

			let retry = 0;
			try {
				const response = await this.#fetch(url, {
					headers: { "User-Agent": userAgent },
					signal: AbortSignal.timeout(30_000),
				});
				retry = retryAfter(response.headers.get("retry-after"), this.#now());
				if (response.ok) {
					const body = await response.json();
					const apiError = body?.error?.code;
					if (!apiError) return body;
					reason = String(apiError);
					if (apiError !== "ratelimited" && apiError !== "maxlag") break;
				} else {
					await response.body?.cancel();
					reason = `HTTP ${response.status}`;
					if (response.status !== 429 && response.status < 500) break;
				}
			} catch (error) {
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
