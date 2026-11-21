import { mapSnapshot } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { matchSetup } from "./fixtures/setup";
import { MATCH_CONTESTS, playMatch } from "./loop";
import { playGame } from "./play";
import { snapshotOf } from "./snapshot";

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 123];
const LANES = ["top", "mid", "bot"] as const;

describe("map snapshots (Q4)", () => {
	it("has the start and one snapshot per minute played, all valid", () => {
		const { snapshots, state } = playGame(matchSetup({ seed: 42 }));
		expect(snapshots.map((s) => s.minute)).toEqual(
			Array.from({ length: state.minute + 1 }, (_, i) => i),
		);
		for (const snapshot of snapshots) mapSnapshot.parse(snapshot);
		expect(snapshots[0]).toMatchObject({
			blue: { gold: 0, kills: 0, dragons: 0, soul: false },
			red: { gold: 0, kills: 0, dragons: 0, soul: false },
		});
	});

	it("ends where playMatch ends and agrees with the events", () => {
		for (const seed of SEEDS) {
			const setup = matchSetup({ seed });
			const { snapshots, events } = playGame(setup);
			const { state } = playMatch(setup, MATCH_CONTESTS);
			expect(snapshots.at(-1)).toEqual(snapshotOf(state));
			const last = snapshots.at(-1);
			const towers = (side: "blue" | "red") =>
				events.filter((e) => e.kind === "tower" && e.side !== side).length;
			for (const side of ["blue", "red"] as const) {
				const s = last?.[side];
				expect(
					(s?.towers.top ?? 0) +
						(s?.towers.mid ?? 0) +
						(s?.towers.bot ?? 0) +
						(s?.nexusTowers ?? 0),
				).toBe(towers(side));
				const count = (kind: string) =>
					events.filter((e) => e.kind === kind && e.side === side).length;
				expect(s?.dragons).toBe(count("dragon"));
				expect(s?.heralds).toBe(count("herald"));
				expect(s?.barons).toBe(count("baron"));
				expect(s?.elders).toBe(count("elder"));
			}
		}
	});

	it("never lowers towers, kills, gold or objectives from one minute to the next", () => {
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			for (let i = 1; i < snapshots.length; i++) {
				for (const side of ["blue", "red"] as const) {
					const a = snapshots[i - 1]?.[side];
					const b = snapshots[i]?.[side];
					if (!a || !b) throw new Error("missing snapshot");
					expect(b.gold).toBeGreaterThanOrEqual(a.gold);
					expect(b.kills).toBeGreaterThanOrEqual(a.kills);
					expect(b.nexusTowers).toBeGreaterThanOrEqual(a.nexusTowers);
					expect(b.dragons).toBeGreaterThanOrEqual(a.dragons);
					for (const lane of LANES) {
						expect(b.towers[lane]).toBeGreaterThanOrEqual(a.towers[lane]);
					}
				}
			}
		}
	});

	it("shows a fallen inhibitor with its respawn minute until that minute", () => {
		let seen = 0;
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			for (const snapshot of snapshots) {
				for (const side of ["blue", "red"] as const) {
					for (const lane of LANES) {
						const back = snapshot[side].inhibitors[lane];
						if (back === null) continue;
						seen++;
						expect(back).toBeGreaterThan(snapshot.minute);
						// Down in every minute until it is back, then null.
						const at = snapshots.find((s) => s.minute === back);
						if (at) expect(at[side].inhibitors[lane]).not.toBe(back);
					}
				}
			}
		}
		expect(seen).toBeGreaterThan(0);
	});

	it("marks the soul at four dragons and keeps active buffs only until they end", () => {
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			for (const snapshot of snapshots) {
				for (const side of ["blue", "red"] as const) {
					const s = snapshot[side];
					expect(s.soul).toBe(s.dragons >= 4);
					for (const end of Object.values(s.buffs)) {
						if (end !== null) expect(end).toBeGreaterThan(snapshot.minute);
					}
				}
			}
		}
	});
});
