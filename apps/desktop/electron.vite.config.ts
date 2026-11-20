import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

const devHost = "127.0.0.1";

const devHmrCsp: Plugin = {
	name: "dev-hmr-csp",
	apply: "serve",
	transformIndexHtml(html, { server }) {
		const address = server?.httpServer?.address();
		if (
			!address ||
			typeof address === "string" ||
			address.address !== devHost
		) {
			return html;
		}

		// Vite can pick a different port if the default is already in use.
		return html.replace(
			/(http-equiv="Content-Security-Policy"\s+content="[^"]+)"/i,
			`$1; connect-src ws://${devHost}:${address.port}"`,
		);
	},
};

export default {
	main: {},
	preload: {},
	renderer: {
		plugins: [tailwindcss(), devHmrCsp],
		build: { assetsInlineLimit: 0 },
		server: { host: devHost },
	},
};
