import { expect, test } from "vitest";
import { cn } from "../lib/utils";

test("keeps the Caja table size next to a text colour", () => {
	expect(cn("text-table", "text-text")).toBe("text-table text-text");
});

test.each([
	["rounded-control", "rounded-none", "rounded-none"],
	["tracking-heading", "tracking-champion", "tracking-champion"],
	["px-gutter", "px-2", "px-2"],
	["gap-gap", "gap-1", "gap-1"],
	["ease-lock", "ease-linear", "ease-linear"],
	["bg-panel", "bg-surface", "bg-surface"],
	["font-display", "font-sans", "font-sans"],
])("lets %s be overridden by %s", (base, override, result) => {
	expect(cn(base, override)).toBe(result);
});
