import { get } from "node:https";
import { communityDragon, dataDragon } from "./catalog";

interface AssetResponse {
	status: number;
	headers: Record<string, string | string[] | undefined>;
	body: AsyncIterable<Uint8Array>;
	dispose?: () => void;
}

export type AssetTransport = (
	url: URL,
	headers: Record<string, string>,
	signal: AbortSignal,
) => Promise<AssetResponse | undefined>;

const timeoutMs = 15_000;
const hosts = new Set([dataDragon, communityDragon]);
const offlineCodes = new Set([
	"EACCES",
	"EPERM",
	"EAI_AGAIN",
	"ENOTFOUND",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"ERR_STREAM_PREMATURE_CLOSE",
]);

export class NetworkUnavailable extends Error {}

function networkFailure(error: unknown, signal: AbortSignal): never {
	if (signal.aborted)
		throw new NetworkUnavailable("Asset request timed out", { cause: error });
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		typeof error.code === "string" &&
		offlineCodes.has(error.code)
	) {
		throw new NetworkUnavailable("Asset network unavailable", { cause: error });
	}
	throw error;
}

export const httpsTransport: AssetTransport = (url, headers, signal) =>
	new Promise((resolve, reject) => {
		const request = get(url, { headers, signal }, (response) => {
			// An abort can arrive while the caller opens the destination file.
			response.on("error", reject);
			resolve({
				status: response.statusCode ?? 0,
				headers: response.headers,
				body: response,
				dispose: () => {
					response.destroy();
				},
			});
		});
		request.on("error", reject);
	});

export async function withResponse<T>(
	transport: AssetTransport,
	url: URL,
	headers: Record<string, string>,
	use: (response: AssetResponse) => Promise<T>,
): Promise<T> {
	if (
		url.protocol !== "https:" ||
		!hosts.has(url.origin) ||
		url.username ||
		url.password
	)
		throw new Error("Invalid asset origin");
	const signal = AbortSignal.timeout(timeoutMs);
	const response = await transport(
		url,
		{ "Accept-Encoding": "identity", ...headers },
		signal,
	).catch((error) => networkFailure(error, signal));
	if (!response) throw new Error("Missing asset response");
	const encoding = response.headers["content-encoding"];
	try {
		if (encoding !== undefined && encoding !== "identity")
			throw new Error("Invalid asset encoding");
		return await use({
			...response,
			body: (async function* () {
				try {
					yield* response.body;
				} catch (error) {
					networkFailure(error, signal);
				}
			})(),
		});
	} finally {
		response.dispose?.();
	}
}

export function responseLength(value: unknown): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !/^\d+$/.test(value))
		throw new Error("Invalid asset length");
	const length = Number(value);
	if (!Number.isSafeInteger(length)) throw new Error("Invalid asset length");
	return length;
}
