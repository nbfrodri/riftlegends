import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RoleIcon } from "../components/role-icon";

afterEach(cleanup);

const roles = ["top", "jungle", "mid", "bot", "support"] as const;

test("renders a distinct square SVG for every role", () => {
	const { container } = render(
		roles.map((role) => <RoleIcon key={role} role={role} />),
	);
	const icons = [...container.querySelectorAll("svg")];
	expect(icons).toHaveLength(roles.length);
	expect(new Set(icons.map((icon) => icon.innerHTML)).size).toBe(roles.length);
	for (const icon of icons) {
		expect(icon.childElementCount).toBeGreaterThan(0);
		expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
		expect(icon.getAttribute("stroke")).toBe("currentColor");
		expect(icon.getAttribute("width")).toBe("20");
		expect(icon.getAttribute("height")).toBe("20");
		expect(icon.getAttribute("aria-hidden")).toBe("true");
	}
	expect(screen.queryByRole("img")).toBeNull();
});

test.each([
	["top", "Top", 16],
	["jungle", "Jungle", 20],
	["mid", "Mid", 24],
	["bot", "ADC", 16],
	["support", "Support", 20],
] as const)("names the standalone %s icon", (role, label, size) => {
	render(<RoleIcon role={role} size={size} label={label} />);
	const icon = screen.getByRole("img", { name: label });
	expect(icon.getAttribute("width")).toBe(String(size));
	expect(icon.getAttribute("height")).toBe(String(size));
});

// Named positions: a literal `role="…"` reads as an ARIA role to the linter.
const positions = {
	top: "top",
	jungle: "jungle",
	mid: "mid",
	bot: "bot",
} as const;

describe("official image", () => {
	test("shows the image in the same box and keeps the accessible name", () => {
		const { container } = render(
			<RoleIcon
				role={positions.mid}
				size={16}
				label="Mid"
				src="rift-asset://cdragon/roles/mid.png"
			/>,
		);
		const icon = screen.getByRole("img", { name: "Mid" });
		expect(icon.tagName).toBe("IMG");
		expect(icon.getAttribute("src")).toBe("rift-asset://cdragon/roles/mid.png");
		expect(icon.getAttribute("width")).toBe("16");
		expect(icon.getAttribute("height")).toBe("16");
		expect(container.querySelector("svg")).toBeNull();
	});

	test("hides an unlabelled image from assistive technology", () => {
		const { container } = render(
			<RoleIcon
				role={positions.top}
				src="rift-asset://cdragon/roles/top.png"
			/>,
		);
		const image = container.querySelector("img");
		expect(image?.getAttribute("alt")).toBe("");
		expect(image?.getAttribute("aria-hidden")).toBe("true");
	});

	test("falls back to the own icon, same size, when the image fails", () => {
		render(
			<RoleIcon
				role={positions.bot}
				size={24}
				label="ADC"
				src="rift-asset://cdragon/roles/bot.png"
			/>,
		);
		fireEvent.error(screen.getByRole("img", { name: "ADC" }));
		const icon = screen.getByRole("img", { name: "ADC" });
		expect(icon.tagName.toLowerCase()).toBe("svg");
		expect(icon.getAttribute("width")).toBe("24");
		expect(icon.getAttribute("height")).toBe("24");
	});
});
