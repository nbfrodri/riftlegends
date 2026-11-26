import type { MatchEvent } from "@rift-legends/contracts";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NumbersNote } from "../src/renderer/match/numbers-note";
import { renderInLocale } from "./render-in-locale";

afterEach(cleanup);

const note = (
	kind: MatchEvent["kind"],
	down: MatchEvent["down"],
	side: MatchEvent["side"] = "red",
) => <NumbersNote event={{ kind, side, down }} />;

test("says how many fought and who was missing, in Spanish", async () => {
	await renderInLocale(note("fight", { blue: ["jungle"], red: [] }), "es-ES");
	expect(
		screen.getByText("Pelearon 4 contra 5: su jungla estaba muerto."),
	).toBeTruthy();
});

test("starts with the short side and lists every one that was down", async () => {
	await renderInLocale(
		note("fight", { blue: [], red: ["jungle", "mid"] }, "blue"),
		"es-ES",
	);
	expect(
		screen.getByText(
			"Pelearon 3 contra 5: su jungla y su mid estaban muertos.",
		),
	).toBeTruthy();
});

test("reads in English", async () => {
	await renderInLocale(note("fight", { blue: ["bot"], red: [] }));
	expect(
		screen.getByText("Fought 4 against 5: their ADC was dead."),
	).toBeTruthy();
});

test("names the rivals' missing players too when both were short", async () => {
	await renderInLocale(
		note("fight", { blue: ["jungle"], red: ["support"] }),
		"es-ES",
	);
	expect(
		screen.getByText(
			"Pelearon 4 contra 4: su support estaba muerto. Los rivales tampoco tenían a su jungla.",
		),
	).toBeTruthy();
});

test("an objective is disputed, not fought", async () => {
	await renderInLocale(note("baron", { blue: ["jungle"], red: [] }), "es-ES");
	expect(
		screen.getByText("Disputaron 4 contra 5: su jungla estaba muerto."),
	).toBeTruthy();
});

test("a lane without its laner has no contest", async () => {
	await renderInLocale(note("lane", { blue: ["top"], red: [] }), "es-ES");
	expect(screen.getByText("Sin disputa: su top estaba muerto.")).toBeTruthy();
});

test("shows nothing when everyone was up", async () => {
	const { container } = await renderInLocale(note("fight", undefined));
	expect(container.textContent).toBe("");
});

test("never uses the middle dot", async () => {
	const { container } = await renderInLocale(
		note("fight", { blue: ["jungle"], red: ["support"] }),
		"es-ES",
	);
	expect(container.textContent).not.toContain("·");
});
