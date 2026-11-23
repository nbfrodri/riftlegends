import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { CountryFlag } from "../src/renderer/draft/country-flag";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

test.each([
	["en-US", "South Korea"],
	["es-ES", "Corea del Sur"],
])("shows a bundled SVG with the country name in %s", async (locale, name) => {
	await renderWithDraftCore(<CountryFlag country="KR" />, locale);
	const flag = screen.getByRole("img", { name });
	expect(flag.tagName.toLowerCase()).toBe("svg");
	await userEvent.setup().hover(flag);
	expect((await screen.findByRole("tooltip")).textContent).toBe(name);
});

test.each([undefined, "ZZ", "xx", "XK"])(
	"omits the flag for %s",
	async (country) => {
		await renderWithDraftCore(<CountryFlag country={country} />);
		expect(screen.queryByRole("img")).toBeNull();
	},
);
