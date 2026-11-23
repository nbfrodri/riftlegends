import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { AssetsProvider } from "../src/renderer/assets";
import { TeamCrest } from "../src/renderer/draft/team-crest";
import { fakeAssets } from "./fake-assets";

afterEach(cleanup);

const logo = "rift-asset://logos/teams/gen-g.png";

function renderCrest(id: string, logos: Record<string, string> = {}) {
	const assets = fakeAssets({ state: "ready", version: "1.0" });
	assets.api.teamLogos.mockResolvedValue(logos);
	return render(
		<AssetsProvider api={assets.api}>
			<TeamCrest id={id} name="Gen.G" />
		</AssetsProvider>,
	);
}

describe("A3: team logos in the crest", () => {
	test("shows the downloaded logo in the same box as the own crest", async () => {
		const { container } = renderCrest("Gen.G", { "Gen.G": logo });
		await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
		const image = container.querySelector("img");
		expect(image?.getAttribute("src")).toBe(logo);
		expect(image?.getAttribute("alt")).toBe("");
		expect(image?.className).toContain("h-[100px] w-[135px]");
	});

	test("shows logos downloaded after the cache became ready, without a restart", async () => {
		const assets = fakeAssets({ state: "ready", version: "1.0" });
		const { container } = render(
			<AssetsProvider api={assets.api}>
				<TeamCrest id="Gen.G" name="Gen.G" />
			</AssetsProvider>,
		);
		await waitFor(() => expect(assets.api.teamLogos).toHaveBeenCalled());
		expect(container.querySelector("img")).toBeNull();
		assets.api.teamLogos.mockResolvedValue({ "Gen.G": logo });
		assets.logosChanged();
		await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
		expect(container.querySelector("img")?.getAttribute("src")).toBe(logo);
	});

	test("falls back to the own crest while there is no logo", () => {
		const { container } = renderCrest("Gen.G");
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("svg")?.textContent).toBe("G");
	});

	test("falls back to the own crest when the logo fails to load", async () => {
		const { container } = renderCrest("Gen.G", { "Gen.G": logo });
		await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
		fireEvent.error(container.querySelector("img") as HTMLImageElement);
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	test("keeps the fictional crests when the team has no logo", async () => {
		const { container } = renderCrest("forge", { "Gen.G": logo });
		await waitFor(() =>
			expect(container.querySelector("svg path")).not.toBeNull(),
		);
		expect(container.querySelector("img")).toBeNull();
	});

	test("works without an AssetsProvider", () => {
		const { container } = render(<TeamCrest id="Gen.G" name="Gen.G" />);
		expect(container.querySelector("svg")).not.toBeNull();
	});

	test("survives the bridge failing", async () => {
		const assets = fakeAssets({ state: "ready", version: "1.0" });
		assets.api.teamLogos.mockRejectedValue(new Error("boom"));
		const { container } = render(
			<AssetsProvider api={assets.api}>
				<TeamCrest id="Gen.G" name="Gen.G" />
			</AssetsProvider>,
		);
		await waitFor(() => expect(assets.api.teamLogos).toHaveBeenCalled());
		expect(container.querySelector("img")).toBeNull();
	});
});
