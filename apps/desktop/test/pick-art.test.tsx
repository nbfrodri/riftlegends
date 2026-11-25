import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { framing, PickArt } from "../src/renderer/draft/board/pick-art";

// Real content with a ready cache, toggled per test (#494).
const real = vi.hoisted(() => ({ on: false }));
vi.mock("../src/renderer/assets", async (original) => ({
	...(await original<typeof import("../src/renderer/assets")>()),
	useAssetSrc: (_source: string, path: string) =>
		real.on ? `rift-asset://cdragon/${path}` : undefined,
}));
vi.mock("../src/renderer/draft/session", async (original) => ({
	...(await original<typeof import("../src/renderer/draft/session")>()),
	useDraftContent: () => (real.on ? "real" : "fictional"),
}));

afterEach(() => {
	cleanup();
	real.on = false;
});

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

	test("#494: Aatrox and Caitlyn are framed on their faces too", () => {
		// Read off the real tiles (user, 25-11): their faces fell in the fade.
		for (const id of ["Aatrox", "Caitlyn"]) {
			const { container } = render(<PickArt id={id} label={id} />);
			const art = container.querySelector("[data-framing]") as HTMLElement;
			expect(art.dataset.framing).toBe("focus");
			cleanup();
		}
	});
});

describe("#494: the landscape splash fills the pick row", () => {
	const art = (id: string) => {
		const { container } = render(<PickArt id={id} label={id} />);
		return container.querySelector("[data-framing]") as HTMLElement;
	};

	test("with real content the base skin's splash covers the art box", () => {
		real.on = true;
		const splash = art("Teemo");
		expect(splash.dataset.framing).toBe("splash");
		expect(screen.getByRole("img", { name: "Teemo" })).toBe(splash);
		const img = splash.querySelector("img") as HTMLImageElement;
		expect(img.getAttribute("src")).toBe(
			"rift-asset://cdragon/splashes/Teemo.jpg",
		);
		expect(img.className).toContain("object-cover");
		// Faces in the centred splash sit a little above its middle.
		expect(img.style.objectPosition).toBe("50% 30%");
	});

	test("a missing splash falls back to the tile framing", () => {
		real.on = true;
		const splash = art("Gwen");
		fireEvent.error(splash.querySelector("img") as HTMLImageElement);
		const tile = document.querySelector("[data-framing]") as HTMLElement;
		expect(tile.dataset.framing).toBe("focus");
		expect(screen.getByRole("img", { name: "Gwen" })).toBeTruthy();
	});

	test("without real content there is no splash", () => {
		expect(art("Ahri").dataset.framing).toBe("default");
	});
});
