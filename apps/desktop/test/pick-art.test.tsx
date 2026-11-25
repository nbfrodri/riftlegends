import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PickArt } from "../src/renderer/draft/board/pick-art";

afterEach(cleanup);

function frame(id: string) {
	const { container } = render(<PickArt id={id} label={id} />);
	const art = container.querySelector("[data-framing]") as HTMLElement;
	expect(screen.getByRole("img", { name: id })).toBeTruthy();
	return { framing: art.dataset.framing, style: art.getAttribute("style") };
}

describe("#438: framing a champion in the pick row", () => {
	test("frames every champion the same way, without per-champion points", () => {
		// Gwen and Kindred had hand-tuned focal points; Ahri never did.
		const frames = ["Gwen", "Kindred", "Ahri"].map((id) => {
			const result = frame(id);
			cleanup();
			return result;
		});
		expect(frames[0]?.framing).toBe("common");
		expect(frames[1]).toEqual(frames[0]);
		expect(frames[2]).toEqual(frames[0]);
	});

	test("#494: the tile is 2.2 times the row's height, cropped 20 % from the top", () => {
		const { container } = render(<PickArt id="Braum" label="Braum" />);
		const art = container.querySelector("[data-framing]") as HTMLElement;
		// Wide enough to reach towards the player's name; the row shows 1/2.2
		// of the tile, from 24 % of the row above it, so faces stay whole.
		expect(art.style.height).toBe("220%");
		expect(art.style.right).toBe("0px");
		expect(art.style.top).toBe("-24%");
	});

	test("#494: the art fades in along an eased gradient that ends inside the image", () => {
		const { container } = render(<PickArt id="Braum" label="Braum" />);
		const art = container.querySelector("[data-framing]") as HTMLElement;
		// Fully transparent for the first 10 % of the tile, so its left edge
		// never shows, then an eased ramp to fully visible at 85 %.
		expect(art.className).toContain(
			"[mask-image:linear-gradient(to_right,transparent_10%,rgb(0_0_0/0.1)_25%,rgb(0_0_0/0.45)_45%,rgb(0_0_0/0.8)_65%,#000_85%)]",
		);
	});
});
