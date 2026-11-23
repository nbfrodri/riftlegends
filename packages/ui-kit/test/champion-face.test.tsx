import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ChampionFace } from "../components/champion-face";

afterEach(cleanup);

test("the placeholder keeps the champion's initials and hue across sizes", () => {
	const { rerender } = render(
		<ChampionFace id="cragbell" label="Guardian of the Crag" size="pool" />,
	);
	const face = screen.getByRole("img", { name: "Guardian of the Crag" });
	expect(face.textContent).toBe("CR");
	expect(face.style.getPropertyValue("--h")).toBe("133");
	rerender(<ChampionFace id="cragbell" size="role" />);
	expect(screen.queryByRole("img")).toBeNull();
	expect(screen.getByText("CR").style.getPropertyValue("--h")).toBe("133");
});

test("a failed portrait falls back in its reserved space and a replacement URL can load", () => {
	const props = {
		id: "cragbell",
		label: "Guardian of the Crag",
		size: "compact",
	} as const;
	const { rerender } = render(
		<ChampionFace {...props} src="first.png" unavailable />,
	);
	const face = screen.getByRole("img", { name: props.label });
	const frame = face.className;
	const portrait = face.querySelector("img");
	expect(portrait?.getAttribute("src")).toBe("first.png");
	if (!portrait) throw new Error("missing portrait");
	fireEvent.error(portrait);
	expect(screen.getByRole("img", { name: props.label })).toBe(face);
	expect(face.className).toBe(frame);
	expect(face.querySelector("img")).toBeNull();
	expect(face.textContent).toBe("CR");
	rerender(<ChampionFace {...props} src="replacement.png" unavailable />);
	expect(face.querySelector("img")?.getAttribute("src")).toBe(
		"replacement.png",
	);
});

test("a failed large art falls back to the icon, then to the initials", () => {
	render(
		<ChampionFace
			id="cragbell"
			label="Guardian of the Crag"
			size="pool"
			src="tile.jpg"
			fallbackSrc="icon.png"
		/>,
	);
	const face = screen.getByRole("img", { name: "Guardian of the Crag" });
	const image = () => face.querySelector("img");
	expect(image()?.getAttribute("src")).toBe("tile.jpg");
	// Square art in a wide box: keep the face, which sits above the centre.
	expect(image()?.className).toContain("object-[50%_30%]");
	fireEvent.error(image() as HTMLImageElement);
	expect(image()?.getAttribute("src")).toBe("icon.png");
	fireEvent.error(image() as HTMLImageElement);
	expect(image()).toBeNull();
	expect(face.textContent).toBe("CR");
});

test("an unavailable champion is greyed with a diagonal stripe and no extra label", () => {
	render(
		<ChampionFace
			id="cragbell"
			label="Guardian of the Crag"
			size="pool"
			unavailable
		/>,
	);
	const face = screen.getByRole("img", { name: "Guardian of the Crag" });
	expect(face.textContent).toBe("CR");
	expect(face.className).toContain("bg-[#303744]");
	expect(face.className).toContain("after:bg-[linear-gradient(to_bottom_right");
	expect(face.className).not.toContain("hsl(var(--h)");
});
