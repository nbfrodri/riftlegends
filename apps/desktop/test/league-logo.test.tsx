import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { LeagueLogo } from "../src/renderer/assets/league-logo";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

test("shows an accessible fallback and replaces it with a synced league logo", async () => {
	const assets = fakeAssets({ state: "ready", version: "1.0" });
	const view = render(
		<AssetsProvider api={assets.api}>
			<LeagueLogo id="LCK" name="LCK" />
		</AssetsProvider>,
	);
	expect(view.getByRole("img", { name: "LCK" }).tagName).toBe("svg");
	const url = "rift-asset://leagues/leagues/lck.png";
	assets.api.leagueLogos.mockResolvedValue({ LCK: url });
	await act(async () => assets.logosChanged());
	const logo = view.getByRole("img", { name: "LCK" });
	expect(logo.getAttribute("src")).toBe(url);
	fireEvent.error(logo);
	expect(view.getByRole("img", { name: "LCK" }).tagName).toBe("svg");
});
