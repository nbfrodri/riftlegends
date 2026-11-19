import tailwindcss from "@tailwindcss/vite";

export default {
	main: {},
	preload: {},
	renderer: {
		plugins: [tailwindcss()],
		build: { assetsInlineLimit: 0 },
		server: { host: "127.0.0.1" },
	},
};
