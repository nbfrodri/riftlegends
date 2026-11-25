import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PlayerAge } from "../src/renderer/player-age";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

test("shows the age on the game date, 18 Jun 2027", async () => {
	await renderWithDraftCore(<PlayerAge birthDate="2000-06-18" />);
	expect(screen.getByText("27")).toBeTruthy();
	cleanup();
	await renderWithDraftCore(<PlayerAge birthDate="2000-06-19" />);
	expect(screen.getByText("26")).toBeTruthy();
});

test("marks an age taken from the year alone as approximate", async () => {
	await renderWithDraftCore(<PlayerAge birthDate="1999" />);
	expect(screen.getByText("~28")).toBeTruthy();
});

test("a missing date is a dash named 'Age unknown'", async () => {
	await renderWithDraftCore(<PlayerAge />);
	const dash = screen.getByRole("img", { name: "Age unknown" });
	expect(dash.textContent).toBe("—");
});
