import { expect, it } from "vitest";
import { pickScorer, pickTotal } from "./components/pick";
import { indexContent } from "./content-index";
import type { AiContext } from "./context";
import { scenario } from "./fixtures/scenario";
import { replyScorer } from "./reply-scorer";

// The shared search must name the champion that scoring every free champion
// one by one would, ties included (#584).

const bruteForce = (base: AiContext, open: readonly string[], last: string) => {
	const ctx: AiContext = {
		...base,
		picks: {
			...base.picks,
			[base.rival]: [...(base.picks[base.rival] ?? []), last],
		},
	};
	const score = pickScorer(ctx);
	let best: string | undefined;
	let bestTotal = Number.MIN_SAFE_INTEGER;
	for (const id of open) {
		if (id === last) continue;
		const total = pickTotal(score, id);
		if (
			total > bestTotal ||
			(total === bestTotal && (best === undefined || id < best))
		) {
			best = id;
			bestTotal = total;
		}
	}
	return best;
};

it.each([
	{ step: 6, order: "first", picks: { forge: ["reedclaw"], shoal: [] } },
	{
		step: 7,
		order: "last",
		picks: { forge: ["reedclaw", "glasswake"], shoal: ["waxblade"] },
	},
	{
		step: 11,
		order: "last",
		picks: { forge: ["reedclaw"], shoal: ["silkflare", "mosshelm"] },
	},
	{
		step: 19,
		order: "last",
		picks: {
			forge: ["glasswake", "reedclaw", "cragbell"],
			shoal: ["waxblade", "mosshelm"],
		},
	},
	// The replying team's pick-order plan (#364): secure, keep and counter.
	{
		step: 9,
		order: "last",
		picks: { forge: ["reedclaw"], shoal: ["cragbell"] },
	},
	{
		step: 16,
		order: "first",
		picks: {
			forge: ["saltspire", "coalstride"],
			shoal: ["duskroot", "copperfin", "bronzehook"],
		},
	},
	{
		step: 11,
		order: "first",
		picks: { forge: ["waxblade"], shoal: ["reedclaw", "copperfin"] },
	},
	{
		step: 19,
		order: "first",
		picks: {
			forge: ["waxblade", "mosshelm", "coalstride", "suncord"],
			shoal: ["glasswake", "reedclaw", "cragbell", "copperfin"],
		},
	},
] as const)(
	"replies like the one by one scoring at step $step",
	({ step, order, picks }) => {
		const ctx = scenario({ step, order, picks });
		const { champions } = indexContent(ctx.content);
		const taken = new Set([...Object.values(picks).flat()]);
		const open = [...champions.keys()].filter((id) => !taken.has(id));
		const base: AiContext = {
			...ctx,
			team: ctx.rival,
			rival: ctx.team,
			order: order === "first" ? "last" : "first",
			wins: [ctx.wins[1], ctx.wins[0]],
		};
		const best = replyScorer(base, open);
		for (const last of open.slice(0, 40))
			expect(best(last), last).toBe(bruteForce(base, open, last));
	},
);
