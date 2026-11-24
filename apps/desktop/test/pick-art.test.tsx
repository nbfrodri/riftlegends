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

	test("zooms less than the cover framing: the row shows 5/8 of the tile", () => {
		const { container } = render(<PickArt id="Braum" label="Braum" />);
		const art = container.querySelector("[data-framing]") as HTMLElement;
		// The tile's side is 1.6 times the row's height, so faces near the top
		// or off-centre stay in view.
		expect(art.style.height).toBe("160%");
		expect(art.style.right).toBe("0px");
	});
});
