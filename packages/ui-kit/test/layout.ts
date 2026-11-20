import { beforeEach } from "vitest";

// happy-dom has no layout, and the virtualised DataTable reads sizes from the
// DOM. This stubs the sizes the virtualiser reads: rows are 24px tall, the header 32px and the
// scrolling region as tall as a test asks (tall by default, so every row of a
// small table is mounted).
export const ROW_HEIGHT = 24;
export const HEAD_HEIGHT = 32;
const DEFAULT_VIEWPORT = 4000;
let viewportHeight = DEFAULT_VIEWPORT;

export const setViewportHeight = (height: number) => {
	viewportHeight = height;
};

beforeEach(() => {
	viewportHeight = DEFAULT_VIEWPORT;
	Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
		configurable: true,
		get(this: HTMLElement) {
			if (this.tagName === "TR") return ROW_HEIGHT;
			if (this.tagName === "THEAD") return HEAD_HEIGHT;
			return 0;
		},
	});
	Object.defineProperty(HTMLElement.prototype, "clientHeight", {
		configurable: true,
		get(this: HTMLElement) {
			return this.getAttribute("role") === "region" ? viewportHeight : 0;
		},
	});
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get: () => 800,
	});
});
