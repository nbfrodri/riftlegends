import { isVersion, versionsUrl } from "./catalog";
import { type AssetTransport, responseLength, withResponse } from "./transport";

export function newer(version: string, current: string): boolean {
	return version.localeCompare(current, "en", { numeric: true }) > 0;
}

export async function candidatePatches(
	transport: AssetTransport,
): Promise<string[]> {
	return withResponse(
		transport,
		versionsUrl,
		{},
		async ({ status, headers, body }) => {
			if (status !== 200)
				throw new Error(`Version lookup failed (HTTP ${status})`);
			const limit = 64 * 1024;
			const expected = responseLength(headers["content-length"]);
			if (expected !== undefined && expected > limit)
				throw new Error("Version list exceeds size limit");
			const chunks: Uint8Array[] = [];
			let size = 0;
			for await (const chunk of body) {
				size += chunk.length;
				if (size > (expected ?? limit))
					throw new Error("Version list exceeds size limit");
				chunks.push(chunk);
			}
			if (expected !== undefined && size !== expected)
				throw new Error("Incomplete version list");
			const versions: unknown = JSON.parse(
				Buffer.concat(chunks).toString("utf8"),
			);
			if (!Array.isArray(versions) || !versions.length)
				throw new Error("Invalid Data Dragon version list");
			const patches = new Set<string>();
			for (const version of versions) {
				if (
					typeof version !== "string" ||
					!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)
				)
					throw new Error("Invalid Data Dragon version");
				const patch = version.slice(0, version.lastIndexOf("."));
				if (!isVersion(patch)) throw new Error("Invalid CommunityDragon patch");
				patches.add(patch);
				if (patches.size === 2) break;
			}
			return [...patches];
		},
	);
}
