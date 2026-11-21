import { describe, expect, it } from "vitest";
import { edge } from "./contests/edge";
import { matchSetup } from "./fixtures/setup";
import type { MentalEdge } from "./mental";
import { createMatch } from "./state";

const neutral: MentalEdge = {
	general: { total: 0, causes: [] },
	byContest: {},
	variance: 10000,
};
const withMental = (blue: Partial<MentalEdge>, red: Partial<MentalEdge> = {}) =>
	matchSetup({
		mental: { blue: { ...neutral, ...blue }, red: { ...neutral, ...red } },
	});

describe("the mental layer in play", () => {
	it("adds its general causes to every contest", () => {
		const state = createMatch(
			withMental({
				general: { total: 50000, causes: [{ key: "momentum", points: 50000 }] },
			}),
		);
		for (const contest of ["lane", "fight", "siege"] as const) {
			expect(edge(state, contest).causes).toContainEqual({
				key: "momentum",
				points: 50000,
			});
		}
	});

	it("adds shotcalling and adaptation only to their contests", () => {
		const state = createMatch(
			withMental(
				{},
				{
					byContest: {
						objective: {
							total: 30000,
							causes: [{ key: "shotcalling", points: 30000 }],
						},
					},
				},
			),
		);
		expect(edge(state, "objective").causes).toContainEqual({
			key: "shotcalling",
			points: -30000,
		});
		expect(edge(state, "lane").causes.map((c) => c.key)).not.toContain(
			"shotcalling",
		);
	});

	it("widens the form of the day for inconsistent teams", () => {
		const spread = (variance: number) => {
			let widest = 0;
			for (let seed = 0; seed < 200; seed++) {
				const { form } = createMatch({
					...withMental({ variance }),
					seed,
				}).context.blue;
				widest =
					form < 0
						? -form > widest
							? -form
							: widest
						: form > widest
							? form
							: widest;
			}
			return widest;
		};
		expect(spread(20000)).toBeGreaterThan(spread(10000));
		expect(spread(10000)).toBeGreaterThan(spread(5000));
	});

	it("plays as before without a mental layer", () => {
		expect(createMatch(matchSetup()).context.blue.form).toBe(
			createMatch(withMental({})).context.blue.form,
		);
	});
});
