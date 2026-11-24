import { type MatchEvent, mapSnapshot } from "@rift-legends/contracts";
import { describe, expect, it } from "vitest";
import { matchSetup } from "./fixtures/setup";
import { type Contest, MATCH_CONTESTS, playMatch } from "./loop";
import { playGame } from "./play";

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
			const { snapshots: direct } = playMatch(setup, MATCH_CONTESTS);
			expect(snapshots.at(-1)).toEqual(direct.at(-1));
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
				expect(s?.grubs).toBe(
					events
						.filter((e) => e.kind === "grub")
						.reduce((sum, e) => sum + (e.grubs?.[side] ?? 0), 0),
				);
				expect(s?.heralds).toBe(count("herald"));
				expect(s?.barons).toBe(count("baron"));
				expect(s?.elders).toBe(count("elder"));
			}
		}
	});

	it("ends with the same player ids, K/D/A and gold as match.ended", () => {
		const seeds = Array.from({ length: 400 }, (_, index) => index + 1);
		let endsOnMinuteBoundary = false;
		for (const seed of seeds) {
			const { snapshots, facts } = playGame(matchSetup({ seed }));
			const ended = facts.find((fact) => fact.type === "match.ended");
			if (!ended) throw new Error("missing match.ended");
			endsOnMinuteBoundary ||= Number(ended.duration) % 60 === 0;
			const players = ended.players as {
				player: string;
				kills: number;
				deaths: number;
				assists: number;
				gold: number;
			}[];
			expect(snapshots.at(-1)?.players, `seed ${seed}`).toMatchObject(
				players.map(({ player, kills, deaths, assists, gold }) => ({
					player,
					kills,
					deaths,
					assists,
					gold,
				})),
			);
		}
		expect(endsOnMinuteBoundary).toBe(true);
	});

	it("never decreases any player's K/D/A, gold or CS", () => {
		for (const seed of SEEDS) {
			const { snapshots } = playGame(matchSetup({ seed }));
			for (const [index, snapshot] of snapshots.entries()) {
				expect(snapshot.players).toHaveLength(10);
				const previous = snapshots[index - 1];
				for (const [slot, player] of snapshot.players.entries()) {
					const before = previous?.players[slot];
					expect(player.player).toBe(before?.player ?? player.player);
					for (const stat of [
						"kills",
						"deaths",
						"assists",
						"gold",
						"cs",
					] as const) {
						if (before)
							expect(player[stat]).toBeGreaterThanOrEqual(before[stat]);
						else expect(player[stat]).toBe(0);
					}
				}
			}
		}
	});

	const csAtTen = (farming: number, laneGold = 0) => {
		const setup = matchSetup();
		const match = {
			...setup.match,
			players: setup.match.players.map((player) => ({
				...player,
				attributes: { ...player.attributes, farming },
			})),
		};
		const testContest: Contest = {
			id: 99,
			due: (state) => state.minute === 10,
			resolve: () => {
				const base = {
					side: "blue",
					kills: [],
					chance: 10_000,
					causes: [],
				} satisfies Partial<MatchEvent>;
				return [
					{
						...base,
						kind: "lane",
						zone: "lane-top",
						second: 10,
						gold: { blue: laneGold, red: 0 },
					},
					{
						...base,
						kind: "nexus",
						zone: "base-red",
						second: 30,
						gold: { blue: 0, red: 0 },
					},
				];
			},
		};
		return playMatch({ ...setup, match }, [testContest]).snapshots.at(-1)
			?.players;
	};

	it("estimates more CS with higher farming and less for jungle and support", () => {
		const high = csAtTen(100);
		const low = csAtTen(0);
		expect(high).toHaveLength(10);
		if (!high?.[0] || !high[1] || !high[4] || !low?.[0]) {
			throw new Error("missing player snapshots");
		}
		expect(high[0].cs).toBeGreaterThan(low[0].cs);
		expect(high[0].cs).toBeGreaterThanOrEqual(80);
		expect(high[0].cs).toBeLessThanOrEqual(90);
		expect(high[1].cs).toBeLessThan(high[0].cs);
		expect(high[4].cs).toBeGreaterThanOrEqual(10);
		expect(high[4].cs).toBeLessThanOrEqual(20);
	});

	it("increases CS for the role and side that won lane gold", () => {
		const baseline = csAtTen(100);
		const withWin = csAtTen(100, 150);
		expect(withWin).toHaveLength(10);
		expect(withWin?.[0]?.cs).toBeGreaterThan(baseline?.[0]?.cs ?? 0);
		expect(withWin?.slice(1).map((line) => line.cs)).toEqual(
			baseline?.slice(1).map((line) => line.cs),
		);
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
