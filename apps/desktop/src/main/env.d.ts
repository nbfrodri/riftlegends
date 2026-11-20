/// <reference types="vite/client" />

/** electron-vite bundles `?modulePath` imports as separate entries and returns their path. */
declare module "*?modulePath" {
	const path: string;
	export default path;
}
