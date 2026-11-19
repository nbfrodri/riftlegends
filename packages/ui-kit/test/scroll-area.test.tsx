import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ScrollArea } from "../components/scroll-area";

afterEach(cleanup);

function Players({ onScroll }: { onScroll?: () => void }) {
	return (
		<ScrollArea
			viewportProps={{
				role: "region",
				"aria-label": "Players",
				...(onScroll ? { onScroll } : {}),
			}}
		>
			<ul>
				<li>Nadir</li>
				<li>Vega</li>
				<li>Lumen</li>
			</ul>
		</ScrollArea>
	);
}

test("exposes a named scrolling region that holds the whole list", () => {
	render(<Players />);
	const region = screen.getByRole("region", { name: "Players" });
	expect(within(region).getAllByRole("listitem")).toHaveLength(3);
});

test("reports scrolling of the region", () => {
	const onScroll = vi.fn();
	render(<Players onScroll={onScroll} />);
	screen
		.getByRole("region", { name: "Players" })
		.dispatchEvent(new Event("scroll"));
	expect(onScroll).toHaveBeenCalledTimes(1);
});

test("adds no inline <style>, which the renderer CSP blocks", () => {
	render(<Players />);
	expect(document.querySelectorAll("style")).toHaveLength(0);
});
