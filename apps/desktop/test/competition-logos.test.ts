import { expect, test } from "vitest";
import leagues from "../../../packages/core/content/real/leagues.json";
import { competitionLogoId } from "../src/renderer/competition/names";

// Every competition of the real season shows its official logo: the snapshot
// must carry one for each (the CBLOL had none before #561).

const formats = import.meta.glob<{ id: string }>(
	"../../../packages/core/content/real/formats/*.json",
	{ eager: true, import: "default" },
);

test("each real competition has a league logo in the snapshot", () => {
	const ids = Object.values(formats).map(({ id }) => id);
	expect(ids).toHaveLength(9);
	const logos = new Set(leagues.leagues.map(({ id }) => id));
	expect(ids.filter((id) => !logos.has(competitionLogoId(id)))).toEqual([]);
});
