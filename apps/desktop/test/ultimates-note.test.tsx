import type { MatchEvent } from "@rift-legends/contracts";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { UltimatesNote } from "../src/renderer/match/ultimates-note";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

type Role = "top" | "jungle" | "mid" | "bot" | "support";
const ult = (role: Role) => ({ role, resource: "ult" as const });
const note = (
	kind: MatchEvent["kind"],
	blue: Role[],
	red: Role[],
	side: MatchEvent["side"] = "red",
) => (
	<UltimatesNote
		event={{
			kind,
			side,
			onCooldown:
				blue.length + red.length > 0
					? { blue: blue.map(ult), red: red.map(ult) }
					: undefined,
		}}
	/>
);

test("says who fought without an ultimate, in Spanish (#339)", async () => {
	await renderInLocale(note("fight", ["jungle"], []), "es-ES");
	expect(screen.getByText("Pelearon sin la ulti de su jungla.")).toBeTruthy();
});

test("lists every ultimate on cooldown of the side that missed more", async () => {
	await renderInLocale(note("fight", ["support"], ["jungle", "mid"]), "es-ES");
	expect(
		screen.getByText(
			"Pelearon sin las ultis de su jungla y su mid. Los rivales tampoco tenían la ulti de su support.",
		),
	).toBeTruthy();
});

test("reads in English", async () => {
	await renderInLocale(note("fight", ["bot"], []));
	expect(
		screen.getByText("Fought without the ultimate of their ADC."),
	).toBeTruthy();
});

test("an objective is contested, not fought", async () => {
	await renderInLocale(note("baron", [], ["mid"]), "es-ES");
	expect(screen.getByText("Disputaron sin la ulti de su mid.")).toBeTruthy();
});

test("shows nothing when every ultimate was ready, and never the middle dot", async () => {
	const { container } = await renderInLocale(note("fight", [], []));
	expect(container.textContent).toBe("");
	cleanup();
	const full = await renderInLocale(
		note("fight", ["jungle"], ["support"]),
		"es-ES",
	);
	expect(full.container.textContent).not.toContain("·");
});
