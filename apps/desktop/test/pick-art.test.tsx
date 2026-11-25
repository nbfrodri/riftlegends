import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { framing, PickArt } from "../src/renderer/draft/board/pick-art";

afterEach(cleanup);

describe("#438, #494: framing a champion on its face in the pick row", () => {
	test("zooms the tile so its focal point lands right of centre", () => {
		// A face left of centre needs zoom to move right without a gap.
		expect(framing({ x: 40, y: 30 })).toEqual({
			width: "175%",
			left: "0%",
			top: "clamp(calc(100cqh - 175cqw), calc(50cqh - 52.5cqw), 0px)",
		});
	});

	test("keeps the tile covering the box when the face is far right", () => {
		expect(framing({ x: 90, y: 50 })).toEqual({
			// The zoom stops at 2x so the 380 px tile stays sharp.
			width: "200%",
			left: "-100%",
			top: "clamp(calc(100cqh - 200cqw), calc(50cqh - 100cqw), 0px)",
		});
	});

	test("uses the champion's focal point when it has one", () => {
		const { container } = render(<PickArt id="Gwen" label="Gwen" />);
		const art = container.querySelector("[data-framing]") as HTMLElement;
		expect(art.dataset.framing).toBe("focus");
		expect(art.style.width).not.toBe("");
		expect(screen.getByRole("img", { name: "Gwen" })).toBeTruthy();
	});

	test("falls back to the default framing without a focal point", () => {
		const { container } = render(<PickArt id="Ahri" label="Ahri" />);
		const art = container.querySelector("[data-framing]") as HTMLElement;
		expect(art.dataset.framing).toBe("default");
		expect(art.style.width).toBe("");
		expect(screen.getByRole("img", { name: "Ahri" })).toBeTruthy();
	});
});
