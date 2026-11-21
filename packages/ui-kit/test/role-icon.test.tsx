import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
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
