import {
	type LeagueLogoMetadata,
	leagueLogosSchema,
	parseRiotLogoUrl,
} from "@rift-legends/contracts/real-logos";
import { Client, lolesportsApi } from "./client.ts";
import { type LogosOptions, writeLogoMetadata } from "./logos.ts";

const leaguesUrl = `${lolesportsApi}/getLeagues?hl=en-US`;
const leagueSlugs = {
	CBLOL: "cblol",
	"First Stand": "first-stand",
	LCK: "lck",
	LCP: "lcp",
	LCS: "lcs",
	LEC: "lec",
	LPL: "lpl",
	MSI: "msi",
	Worlds: "worlds",
} as const;

function parseApiLeagues(body: unknown) {
	const leagues = (body as { data?: { leagues?: unknown } } | null)?.data
		?.leagues;
	if (!Array.isArray(leagues)) throw new Error("Invalid lolesports leagues");
	return leagues.map((league) => {
		const { id, slug, name, region, image } = league ?? {};
		if (
			typeof id !== "string" ||
			typeof slug !== "string" ||
			typeof name !== "string" ||
			typeof region !== "string" ||
			(image != null && typeof image !== "string")
		) {
			throw new Error("Invalid lolesports league");
		}
		return {
			slug: slug.toLowerCase().replaceAll("_", "-"),
			image: typeof image === "string" ? image : null,
		};
	});
}

export async function writeLeagueLogos(options: LogosOptions) {
	const client = new Client(options);
	const source = await client.get(leaguesUrl, parseApiLeagues);
	const leagues: LeagueLogoMetadata[] = [];
	const unmatched: { id: string; reason: string }[] = [];
	for (const [id, slug] of Object.entries(leagueSlugs)) {
		const matches = source.filter((league) => league.slug === slug);
		const image = matches.length === 1 ? matches[0]?.image : null;
		const url =
			image &&
			parseRiotLogoUrl(image.replace(/^http:\/\//i, "https://"), "league");
		if (!url) {
			const reason = matches.length > 1 ? "ambiguous" : "no usable logo URL";
			unmatched.push({ id, reason });
			continue;
		}
		try {
			const digest = await client.imageDigest(url.href);
			leagues.push(
				leagueLogosSchema.shape.leagues.element.parse({
					id,
					url: url.href,
					...digest,
				}),
			);
		} catch (error) {
			unmatched.push({
				id,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}
	const file = leagueLogosSchema.parse({
		provenance: {
			source: "lolesports.com",
			endpoint: leaguesUrl,
			retrievedAt: client.queries.get(leaguesUrl),
			note: "Logo URLs from the public lolesports.com web API (getLeagues). The images are downloaded by the app at runtime, never committed.",
		},
		leagues,
	});
	await writeLogoMetadata(
		options.outputDir,
		"leagues.json",
		file,
		"leagues",
		leagueLogosSchema,
	);
	return {
		logos: leagues.length,
		total: Object.keys(leagueSlugs).length,
		unmatched,
	};
}
