import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { CountryFlag } from "../src/renderer/draft/country-flag";
import { renderWithDraftCore } from "./draft-core";

afterEach(cleanup);

test.each([
	["en-US", "South Korea"],
	["es-ES", "Corea del Sur"],
])("shows a bundled SVG with the country name in %s", async (locale, name) => {
	await renderWithDraftCore(<CountryFlag country="KR" />, locale);
	expect(screen.getByRole("img", { name }).tagName.toLowerCase()).toBe("svg");
});

test.each([undefined, "ZZ", "xx", "XK"])(
	"omits the flag for %s",
	async (country) => {
		await renderWithDraftCore(<CountryFlag country={country} />);
		expect(screen.queryByRole("img")).toBeNull();
	},
);
